import { MockProxy, mock } from "jest-mock-extended";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
import { RegisterFinishRequestWithAuthUnlockDataTypes } from "@bitwarden/common/auth/models/request/registration/register-finish-request-with-auth-unlock-data.types";
import { RegisterFinishRequest } from "@bitwarden/common/auth/models/request/registration/register-finish.request";
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
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KeyService, KdfType } from "@bitwarden/key-management";

import { PasswordInputResult } from "../../input-password/password-input-result";

import { DefaultRegistrationFinishService } from "./default-registration-finish.service";

describe("DefaultRegistrationFinishService", () => {
  let service: DefaultRegistrationFinishService;

  let keyService: MockProxy<KeyService>;
  let accountApiService: MockProxy<AccountApiService>;
  let masterPasswordService: MockProxy<MasterPasswordServiceAbstraction>;
  let configService: MockProxy<ConfigService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    accountApiService = mock<AccountApiService>();
    masterPasswordService = mock<MasterPasswordServiceAbstraction>();
    configService = mock<ConfigService>();

    service = new DefaultRegistrationFinishService(
      keyService,
      accountApiService,
      masterPasswordService,
      configService,
    );
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

    beforeEach(() => {
      email = "test@email.com";
      emailVerificationToken = "emailVerificationToken";
      masterKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey;
      passwordInputResult = {
        newMasterKey: masterKey,
        newServerMasterKeyHash: "newServerMasterKeyHash",
        newLocalMasterKeyHash: "newLocalMasterKeyHash",
        kdfConfig: DEFAULT_KDF_CONFIG,
        newPasswordHint: "newPasswordHint",
        newPassword: "newPassword",
      };

      userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
      userKeyEncString = new EncString("userKeyEncrypted");

      userKeyPair = ["publicKey", new EncString("privateKey")];
    });

    it("throws an error if the user key cannot be created", async () => {
      keyService.makeUserKey.mockResolvedValue([null, null]);

      await expect(service.finishRegistration(email, passwordInputResult)).rejects.toThrow(
        "User key could not be created",
      );
    });

    describe("when feature flag is OFF (old API)", () => {
      it("registers the user with KDF fields when given valid email verification input", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();

        await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

        expect(keyService.makeUserKey).toHaveBeenCalledWith(masterKey);
        expect(keyService.makeKeyPair).toHaveBeenCalledWith(userKey);
        expect(accountApiService.registerFinish).toHaveBeenCalledWith(
          expect.objectContaining({
            email,
            emailVerificationToken: emailVerificationToken,
            masterPasswordHash: passwordInputResult.newServerMasterKeyHash,
            masterPasswordHint: passwordInputResult.newPasswordHint,
            userSymmetricKey: userKeyEncString.encryptedString,
            userAsymmetricKeys: {
              publicKey: userKeyPair[0],
              encryptedPrivateKey: userKeyPair[1].encryptedString,
            },
            kdf: KdfType.PBKDF2_SHA256,
            kdfIterations: DEFAULT_KDF_CONFIG.iterations,
            kdfMemory: undefined,
            kdfParallelism: undefined,
          }),
        );

        // Verify makeMasterKey is NOT called — the master key comes from passwordInputResult directly
        expect(keyService.makeMasterKey).not.toHaveBeenCalled();

        // Verify old API fields are present
        const registerCall = accountApiService.registerFinish.mock.calls[0][0];
        expect(registerCall).toBeInstanceOf(RegisterFinishRequest);
        expect((registerCall as RegisterFinishRequest).kdf).toBeDefined();
        expect((registerCall as RegisterFinishRequest).kdfIterations).toBeDefined();

        // Verify new API fields are NOT present
        expect((registerCall as any).masterPasswordAuthentication).toBeUndefined();
        expect((registerCall as any).masterPasswordUnlock).toBeUndefined();

        expect(registerCall).toMatchSnapshot();
      });
    });

    describe("when feature flag is ON (new API)", () => {
      let salt: MasterPasswordSalt;
      let masterPasswordAuthentication: MasterPasswordAuthenticationData;
      let masterPasswordUnlock: MasterPasswordUnlockData;

      beforeEach(() => {
        salt = "test@email.com" as MasterPasswordSalt;

        // When the Auth flag is ON, InputPasswordComponent emits newApisWithInputPasswordFlagEnabled: true
        // and does NOT emit newMasterKey, newServerMasterKeyHash, or newLocalMasterKeyHash.
        passwordInputResult = {
          newPassword: "newPassword",
          kdfConfig: DEFAULT_KDF_CONFIG,
          newPasswordHint: "newPasswordHint",
          newApisWithInputPasswordFlagEnabled: true,
          salt: salt,
        };

        // The service derives the master key internally when the Auth flag is ON
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

      it("derives the master key and registers the user with new data types", async () => {
        keyService.makeUserKey.mockResolvedValue([userKey, userKeyEncString]);
        keyService.makeKeyPair.mockResolvedValue(userKeyPair);
        accountApiService.registerFinish.mockResolvedValue();

        await service.finishRegistration(email, passwordInputResult, emailVerificationToken);

        // Verify master key is derived internally (not from passwordInputResult)
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

        // Verify new API fields are present
        const registerCall = accountApiService.registerFinish.mock.calls[0][0];
        expect(registerCall).toBeInstanceOf(RegisterFinishRequestWithAuthUnlockDataTypes);
        expect(
          (registerCall as RegisterFinishRequestWithAuthUnlockDataTypes)
            .masterPasswordAuthentication,
        ).toBeDefined();
        expect(
          (registerCall as RegisterFinishRequestWithAuthUnlockDataTypes).masterPasswordUnlock,
        ).toBeDefined();

        // Verify old API fields are NOT present (including masterPasswordHash which is in masterPasswordAuthentication)
        expect((registerCall as any).masterPasswordHash).toBeUndefined();
        expect((registerCall as any).userSymmetricKey).toBeUndefined();
        expect((registerCall as any).kdf).toBeUndefined();
        expect((registerCall as any).kdfIterations).toBeUndefined();

        expect(registerCall).toMatchSnapshot();
      });
    });
  });
});
