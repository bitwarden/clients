import { MockProxy, mock } from "jest-mock-extended";
import { of } from "rxjs";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordUnlockData,
  MasterPasswordSalt,
  MasterKeyWrappedUserKey,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KeyService } from "@bitwarden/key-management";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { DefaultRegistrationFinishService } from "./default-registration-finish.service";

describe("DefaultRegistrationFinishService", () => {
  let service: DefaultRegistrationFinishService;

  let keyService: MockProxy<KeyService>;
  let accountApiService: MockProxy<AccountApiService>;
  let masterPasswordService: MockProxy<MasterPasswordServiceAbstraction>;
  let configService: MockProxy<ConfigService>;
  let sdkService: MockProxy<SdkService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    accountApiService = mock<AccountApiService>();
    masterPasswordService = mock<MasterPasswordServiceAbstraction>();
    configService = mock<ConfigService>();
    sdkService = mock<SdkService>();

    service = new DefaultRegistrationFinishService(
      keyService,
      accountApiService,
      masterPasswordService,
      configService,
      sdkService,
    );

    configService.getFeatureFlag.mockResolvedValue(false);
  });

  it("instantiates", () => {
    expect(service).not.toBeFalsy();
  });

  describe("getMasterPasswordPolicyOptsFromOrgInvite()", () => {
    it("returns null", async () => {
      const result = await service.getMasterPasswordPolicyOptsFromOrgInvite();

      expect(result).toBeNull();
    });
  });

  describe("getOrgNameFromOrgInvite()", () => {
    it("returns null", async () => {
      const result = await service.getOrgNameFromOrgInvite();

      expect(result).toBeNull();
    });
  });

  describe("finishRegistration()", () => {
    let email: string;
    let emailVerificationToken: string;
    let masterKey: MasterKey;
    let passwordInputResult: PasswordInputResult;
    let userKey: UserKey;
    let userKeyEncString: EncString;
    let userKeyPair: [string, EncString];
    let salt: MasterPasswordSalt;
    let masterPasswordAuthentication: MasterPasswordAuthenticationData;
    let masterPasswordUnlock: MasterPasswordUnlockData;

    beforeEach(() => {
      email = "test@email.com";
      emailVerificationToken = "emailVerificationToken";
      masterKey = new SymmetricCryptoKey(new Uint8Array(64)) as MasterKey;
      salt = "test@email.com" as MasterPasswordSalt;

      passwordInputResult = {
        newPassword: "newPassword",
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
        salt: salt,
      };

      userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
      userKeyEncString = new EncString("userKeyEncrypted");
      userKeyPair = ["publicKey", new EncString("privateKey")];

      keyService.makeMasterKey.mockResolvedValue(masterKey);

      masterPasswordAuthentication = {
        salt,
        kdf: DEFAULT_KDF_CONFIG,
        masterPasswordAuthenticationHash: "authHash" as MasterPasswordAuthenticationHash,
      };
      masterPasswordUnlock = new MasterPasswordUnlockData(
        salt,
        DEFAULT_KDF_CONFIG,
        "wrappedUserKey" as MasterKeyWrappedUserKey,
      );
      masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue(
        masterPasswordAuthentication,
      );
      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(masterPasswordUnlock);
    });

    ["newPassword", "salt"].forEach((key) => {
      it(`should throw if ${key} is an empty string (falsy) on the PasswordInputResult object`, async () => {
        // Arrange
        const invalidPasswordInputResult: PasswordInputResult = {
          ...passwordInputResult,
          [key]: "",
        };

        // Act
        const promise = service.finishRegistration(email, invalidPasswordInputResult);

        // Assert
        await expect(promise).rejects.toThrow(`${key} is falsy. Could not finish registration.`);
      });
    });

    it("should throw if kdfConfig is undefined on the PasswordInputResult object", async () => {
      // Arrange
      const invalidPasswordInputResult: PasswordInputResult = {
        ...passwordInputResult,
        kdfConfig: undefined,
      };

      // Act
      const promise = service.finishRegistration(email, invalidPasswordInputResult);

      // Assert
      await expect(promise).rejects.toThrow(
        "kdfConfig is null or undefined. Could not finish registration.",
      );
    });

    it("throws an error if the user key cannot be created", async () => {
      keyService.makeUserKey.mockResolvedValue([null, null] as any);

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow(
        "User key could not be created",
      );
    });

    it("derives the master key and registers the user", async () => {
      keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
      keyService.makeKeyPair.mockResolvedValue(userKeyPair);
      accountApiService.registerFinish.mockResolvedValue();

      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      expect(keyService.makeMasterKey).toHaveBeenCalledWith(
        passwordInputResult.newPassword,
        passwordInputResult.salt,
        passwordInputResult.kdfConfig,
      );
      expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
      expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);
      expect(accountApiService.registerFinish).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          emailVerificationToken: emailVerificationToken,
          masterPasswordHint: passwordInputResult.newPasswordHint,
          userAsymmetricKeys: {
            publicKey: userKeyPair[0],
            encryptedPrivateKey: userKeyPair[1].encryptedString,
          },
          masterPasswordAuthentication: masterPasswordAuthentication,
          masterPasswordUnlock: masterPasswordUnlock,
        }),
      );

      const registerCall = accountApiService.registerFinish.mock.calls[0][0];
      expect(registerCall).toBeInstanceOf(RegisterFinishRequest);
      expect((registerCall as RegisterFinishRequest).masterPasswordAuthentication).toBeDefined();
      expect((registerCall as RegisterFinishRequest).masterPasswordUnlock).toBeDefined();

      expect(registerCall).toMatchSnapshot();
    });

    it("does not invoke the SDK flow when the feature flag is off", async () => {
      keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
      keyService.makeKeyPair.mockResolvedValue(userKeyPair);

      const postKeysForUserPasswordRegistration: jest.Mock = jest.fn().mockResolvedValue(undefined);
      const registrationClient: { post_keys_for_user_password_registration: jest.Mock } = {
        post_keys_for_user_password_registration: postKeysForUserPasswordRegistration,
      };
      const authClient: { registration: jest.Mock } = {
        registration: jest.fn().mockReturnValue(registrationClient),
      };
      const sdkClient: { auth: jest.Mock } = { auth: jest.fn().mockReturnValue(authClient) };

      sdkService.client$ = of(sdkClient as any);

      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);
      expect(accountApiService.registerFinish).toHaveBeenCalled();
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled(); // sdk is not called when ff is off
    });
  });

  // SDK-based registration flow. This block is fully self-contained so it can stand alone once the
  // legacy registration flow above is removed.
  describe("finishRegistration() - SDK flow", () => {
    let email: string;
    let emailVerificationToken: string;
    let salt: MasterPasswordSalt;
    let passwordInputResult: PasswordInputResult;

    let postKeysForUserPasswordRegistration: jest.Mock;
    let registrationClient: { post_keys_for_user_password_registration: jest.Mock };
    let authClient: { registration: jest.Mock };
    let sdkClient: { auth: jest.Mock };

    // web-only tokens/ids exercised by the SDK register request
    const orgSponsoredFreeFamilyPlanToken = "orgSponsoredFreeFamilyPlanToken";
    const acceptEmergencyAccessInviteToken = "acceptEmergencyAccessInviteToken";
    const emergencyAccessId = "00000000-0000-0000-0000-000000000001";
    const providerInviteToken = "providerInviteToken";
    const providerUserId = "00000000-0000-0000-0000-000000000002";

    beforeEach(() => {
      email = "test@email.com";
      emailVerificationToken = "emailVerificationToken";
      salt = "test@email.com" as MasterPasswordSalt;

      passwordInputResult = {
        newPassword: "newPassword",
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
        salt: salt,
      };

      configService.getFeatureFlag.mockImplementation((flag) =>
        Promise.resolve(flag === FeatureFlag.EnableAccountEncryptionV2UserPasswordRegistration),
      );

      postKeysForUserPasswordRegistration = jest.fn().mockResolvedValue(undefined);
      registrationClient = {
        post_keys_for_user_password_registration: postKeysForUserPasswordRegistration,
      };
      authClient = { registration: jest.fn().mockReturnValue(registrationClient) };
      sdkClient = { auth: jest.fn().mockReturnValue(authClient) };

      sdkService.client$ = of(sdkClient as any);
    });

    ["newPassword", "salt"].forEach((key) => {
      it(`should throw if ${key} is an empty string (falsy) on the PasswordInputResult object`, async () => {
        const invalidPasswordInputResult: PasswordInputResult = {
          ...passwordInputResult,
          [key]: "",
        };

        const promise = service.finishRegistration(email, invalidPasswordInputResult);

        await expect(promise).rejects.toThrow(`${key} is falsy. Could not finish registration.`);
        expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
      });
    });

    it("should throw if kdfConfig is undefined on the PasswordInputResult object", async () => {
      const invalidPasswordInputResult: PasswordInputResult = {
        ...passwordInputResult,
        kdfConfig: undefined,
      };

      const promise = service.finishRegistration(email, invalidPasswordInputResult);

      await expect(promise).rejects.toThrow(
        "kdfConfig is null or undefined. Could not finish registration.",
      );
      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("throws an error if the SDK client is not available", async () => {
      sdkService.client$ = of(null as any);

      await expect(
        service.finishRegistration(email, passwordInputResult, emailVerificationToken),
      ).rejects.toThrow("SDK not available");

      expect(postKeysForUserPasswordRegistration).not.toHaveBeenCalled();
    });

    it("posts the user password registration keys via the SDK and does not use the legacy flow", async () => {
      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      expect(postKeysForUserPasswordRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          salt: passwordInputResult.salt,
          master_password: passwordInputResult.newPassword,
          master_password_hint: passwordInputResult.newPasswordHint,
          email_verification_token: emailVerificationToken,
        }),
      );

      // The legacy (non-SDK) flow must not be exercised.
      expect(keyService.makeMasterKey).not.toHaveBeenCalled();
      expect(keyService.makeUserKey).not.toHaveBeenCalled();
      expect(keyService.makeKeyPair).not.toHaveBeenCalled();
      expect(accountApiService.registerFinish).not.toHaveBeenCalled();
    });

    it("does not pass the web-only tokens and ids through to the SDK register request", async () => {
      await service.finishRegistration(
        email,
        passwordInputResult,
        emailVerificationToken,
        orgSponsoredFreeFamilyPlanToken,
        acceptEmergencyAccessInviteToken,
        emergencyAccessId,
        providerInviteToken,
        providerUserId,
      );

      expect(postKeysForUserPasswordRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          email,
          salt: passwordInputResult.salt,
          master_password: passwordInputResult.newPassword,
          master_password_hint: passwordInputResult.newPasswordHint,
          email_verification_token: emailVerificationToken,
          organization_user_id: undefined,
          org_invite_token: undefined,
          org_sponsored_free_family_plan_token: undefined,
          accept_emergency_access_invite_token: undefined,
          accept_emergency_access_id: undefined,
          provider_invite_token: undefined,
          provider_user_id: undefined,
        }),
      );
    });

    it("leaves the emergency access and provider ids undefined when not provided", async () => {
      await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

      expect(postKeysForUserPasswordRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          accept_emergency_access_id: undefined,
          provider_user_id: undefined,
        }),
      );
    });
  });
});
