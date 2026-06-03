import { MockProxy, mock } from "jest-mock-extended";

import { AccountApiService } from "@bitwarden/common/auth/abstractions/account-api.service";
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

  beforeEach(() => {
    keyService = mock<KeyService>();
    accountApiService = mock<AccountApiService>();
    masterPasswordService = mock<MasterPasswordServiceAbstraction>();

    service = new DefaultRegistrationFinishService(
      keyService,
      accountApiService,
      masterPasswordService,
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
  });
});
