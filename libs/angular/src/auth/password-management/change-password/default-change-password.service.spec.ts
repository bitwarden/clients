import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { makeSymmetricCryptoKey, mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";

import {
  ChangePasswordService,
  InvalidCurrentPasswordError,
} from "./change-password.service.abstraction";
import { DefaultChangePasswordService } from "./default-change-password.service";

describe("DefaultChangePasswordService", () => {
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let masterPasswordUnlockService: MockProxy<MasterPasswordUnlockService>;

  let sut: ChangePasswordService;

  const userId = "userId" as UserId;

  const user: Account = {
    id: userId,
    ...mockAccountInfoWith({
      email: "email",
      name: "name",
      emailVerified: false,
    }),
  };

  const passwordInputResult: PasswordInputResult = {
    currentMasterKey: new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
    currentServerMasterKeyHash: "currentServerMasterKeyHash",

    newPassword: "newPassword",
    newPasswordHint: "newPasswordHint",
    newMasterKey: new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
    newServerMasterKeyHash: "newServerMasterKeyHash",

    kdfConfig: PBKDF2KdfConfig.createDefault(),
    newApisWithInputPasswordFlagEnabled: false,
  };

  const decryptedUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const newMasterKeyEncryptedUserKey: [UserKey, EncString] = [
    decryptedUserKey,
    { encryptedString: "newMasterKeyEncryptedUserKey" } as EncString,
  ];

  beforeEach(() => {
    keyService = mock<KeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    masterPasswordUnlockService = mock<MasterPasswordUnlockService>();

    sut = new DefaultChangePasswordService(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      masterPasswordUnlockService,
    );

    masterPasswordService.decryptUserKeyWithMasterKey.mockResolvedValue(decryptedUserKey);
    keyService.encryptUserKeyWithMasterKey.mockResolvedValue(newMasterKeyEncryptedUserKey);
  });

  describe("changePasswordAndRotateUserKey()", () => {
    // Mock method params
    let passwordInputResult: PasswordInputResult;

    beforeEach(() => {
      // Mock method params
      passwordInputResult = {
        currentPassword: "current-password",
        newPassword: "new-password",
        newPasswordHint: "new-password-hint",
        kdfConfig: DEFAULT_KDF_CONFIG,
        salt: "salt" as MasterPasswordSalt,
        newApisWithInputPasswordFlagEnabled: true,
      };
    });

    it("should throw an error by default since changePasswordAndRotateUserKey() is only implemented in Web", async () => {
      // Act
      const promise = sut.changePasswordAndRotateUserKey(passwordInputResult, user);

      // Assert
      await expect(promise).rejects.toThrow(
        "changePasswordAndRotateUserKey() is only implemented in Web",
      );
    });
  });

  describe("changePassword() and changePasswordForAccountRecovery() [PM27086_UpdateAuthenticationApisForInputPassword flag ENABLED]", () => {
    // Mock method params
    let passwordInputResult: PasswordInputResult;

    // Mock method data
    let userKey: UserKey;
    let newAuthenticationData: MasterPasswordAuthenticationData;
    let newUnlockData: MasterPasswordUnlockData;

    beforeEach(() => {
      // Mock method params
      passwordInputResult = {
        currentPassword: "current-password",
        newPassword: "new-password",
        newPasswordHint: "new-password-hint",
        kdfConfig: DEFAULT_KDF_CONFIG,
        salt: "salt" as MasterPasswordSalt,
        newApisWithInputPasswordFlagEnabled: true,
      };

      // Mock method data
      userKey = makeSymmetricCryptoKey(64) as UserKey;

      newAuthenticationData = {
        salt: passwordInputResult.salt,
        kdf: passwordInputResult.kdfConfig,
        masterPasswordAuthenticationHash:
          "newMasterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };

      newUnlockData = {
        salt: passwordInputResult.salt,
        kdf: passwordInputResult.kdfConfig,
        masterKeyWrappedUserKey: "newMasterKeyWrappedUserKey" as MasterKeyWrappedUserKey,
      } as MasterPasswordUnlockData;

      // Mock returned/resolved values
      masterPasswordUnlockService.proofOfDecryption.mockResolvedValue(true);
      keyService.userKey$.mockReturnValue(of(userKey));
      masterPasswordService.makeMasterPasswordUnlockData.mockResolvedValue(newUnlockData);
    });

    describe("changePassword()", () => {
      let currentAuthenticationData: MasterPasswordAuthenticationData;
      let request: PasswordRequest;

      beforeEach(() => {
        currentAuthenticationData = {
          salt: passwordInputResult.salt,
          kdf: passwordInputResult.kdfConfig,
          masterPasswordAuthenticationHash:
            "currentMasterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
        };

        request = PasswordRequest.newConstructor(
          currentAuthenticationData.masterPasswordAuthenticationHash,
          newAuthenticationData,
          newUnlockData,
          passwordInputResult.newPasswordHint,
        );

        masterPasswordService.makeMasterPasswordAuthenticationData
          .mockResolvedValueOnce(currentAuthenticationData) // first call: current auth data
          .mockResolvedValueOnce(newAuthenticationData); // second call: new auth data
      });

      describe("error handling", () => {
        ["currentPassword", "newPassword", "salt"].forEach((key) => {
          it(`should throw if ${key} is an empty string (falsy) on the PasswordInputResult object`, async () => {
            // Arrange
            const invalidPasswordInputResult: PasswordInputResult = {
              ...passwordInputResult,
              [key]: "",
            };

            // Act
            const promise = sut.changePassword(invalidPasswordInputResult, userId);

            // Assert
            await expect(promise).rejects.toThrow(`${key} is falsy. Could not change password.`);
          });
        });

        ["kdfConfig", "newPasswordHint"].forEach((key) => {
          it(`should throw if ${key} is null on the PasswordInputResult object`, async () => {
            // Arrange
            const invalidPasswordInputResult: PasswordInputResult = {
              ...passwordInputResult,
              [key]: null,
            };

            // Act
            const promise = sut.changePassword(invalidPasswordInputResult, userId);

            // Assert
            await expect(promise).rejects.toThrow(
              `${key} is null or undefined. Could not change password.`,
            );
          });
        });

        it("should throw if the current password is invalid (proofOfDecryption failed)", async () => {
          // Arrange
          masterPasswordUnlockService.proofOfDecryption.mockResolvedValue(false);

          // Act
          const promise = sut.changePassword(passwordInputResult, userId);

          // Assert
          await expect(promise).rejects.toThrow(InvalidCurrentPasswordError);
        });

        it("should throw if the userKey is not found", async () => {
          // Arrange
          keyService.userKey$.mockReturnValue(of(null));

          // Act
          const promise = sut.changePassword(passwordInputResult, userId);

          // Assert
          await expect(promise).rejects.toThrow("Failed to get userKey");
        });
      });

      it("should call makeMasterPasswordAuthenticationData twice and makeMasterPasswordUnlockData once with the correct arguments", async () => {
        // Act
        await sut.changePassword(passwordInputResult, userId);

        // Assert
        // First call for current authentication data
        expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenNthCalledWith(
          1,
          passwordInputResult.currentPassword,
          passwordInputResult.kdfConfig,
          passwordInputResult.salt,
        );

        // Second call for new authentication data
        expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenNthCalledWith(
          2,
          passwordInputResult.newPassword,
          passwordInputResult.kdfConfig,
          passwordInputResult.salt,
        );

        expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
          passwordInputResult.newPassword,
          passwordInputResult.kdfConfig,
          passwordInputResult.salt,
          userKey,
        );

        expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledTimes(2);
        expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledTimes(1);
      });

      it("should call the postPassword() API method with the correct PasswordRequest", async () => {
        // Act
        await sut.changePassword(passwordInputResult, userId);

        // Assert
        expect(masterPasswordApiService.postPassword).toHaveBeenCalledTimes(1);
        expect(masterPasswordApiService.postPassword).toHaveBeenCalledWith(request);
      });
    });

    describe("changePasswordForAccountRecovery()", () => {
      let request: UpdateTempPasswordRequest;

      beforeEach(() => {
        request = UpdateTempPasswordRequest.newConstructorWithHint(
          newAuthenticationData,
          newUnlockData,
          passwordInputResult.newPasswordHint,
        );

        masterPasswordService.makeMasterPasswordAuthenticationData.mockResolvedValue(
          newAuthenticationData,
        );
      });

      describe("error handling", () => {
        ["currentPassword", "newPassword", "salt"].forEach((key) => {
          it(`should throw if ${key} is an empty string (falsy) on the PasswordInputResult object`, async () => {
            // Arrange
            const invalidPasswordInputResult: PasswordInputResult = {
              ...passwordInputResult,
              [key]: "",
            };

            // Act
            const promise = sut.changePasswordForAccountRecovery(
              invalidPasswordInputResult,
              userId,
            );

            // Assert
            await expect(promise).rejects.toThrow(
              `${key} is falsy. Could not change password for account recovery.`,
            );
          });
        });

        ["kdfConfig", "newPasswordHint"].forEach((key) => {
          it(`should throw if ${key} is null on the PasswordInputResult object`, async () => {
            // Arrange
            const invalidPasswordInputResult: PasswordInputResult = {
              ...passwordInputResult,
              [key]: null,
            };

            // Act
            const promise = sut.changePasswordForAccountRecovery(
              invalidPasswordInputResult,
              userId,
            );

            // Assert
            await expect(promise).rejects.toThrow(
              `${key} is null or undefined. Could not change password for account recovery.`,
            );
          });
        });

        it("should throw if the current password is invalid (proofOfDecryption failed)", async () => {
          // Arrange
          masterPasswordUnlockService.proofOfDecryption.mockResolvedValue(false);

          // Act
          const promise = sut.changePasswordForAccountRecovery(passwordInputResult, userId);

          // Assert
          await expect(promise).rejects.toThrow(InvalidCurrentPasswordError);
        });

        it("should throw if the userKey is not found", async () => {
          // Arrange
          keyService.userKey$.mockReturnValue(of(null));

          // Act
          const promise = sut.changePasswordForAccountRecovery(passwordInputResult, userId);

          // Assert
          await expect(promise).rejects.toThrow("Failed to get userKey");
        });
      });

      it("should call makeMasterPasswordAuthenticationData once and makeMasterPasswordUnlockData once with the correct arguments", async () => {
        // Act
        await sut.changePasswordForAccountRecovery(passwordInputResult, userId);

        // Assert
        expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledWith(
          passwordInputResult.newPassword,
          passwordInputResult.kdfConfig,
          passwordInputResult.salt,
        );

        expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledWith(
          passwordInputResult.newPassword,
          passwordInputResult.kdfConfig,
          passwordInputResult.salt,
          userKey,
        );

        expect(masterPasswordService.makeMasterPasswordAuthenticationData).toHaveBeenCalledTimes(1);
        expect(masterPasswordService.makeMasterPasswordUnlockData).toHaveBeenCalledTimes(1);
      });

      it("should call the putUpdateTempPassword() API method with the correct UpdateTempPasswordRequest", async () => {
        // Act
        await sut.changePasswordForAccountRecovery(passwordInputResult, userId);

        // Assert
        expect(masterPasswordApiService.putUpdateTempPassword).toHaveBeenCalledTimes(1);
        expect(masterPasswordApiService.putUpdateTempPassword).toHaveBeenCalledWith(request);
      });
    });
  });

  describe("shouldNavigateToRoot()", () => {
    it("should return false", () => {
      // Act
      const shouldNavigateToRoot = sut.shouldNavigateToRoot();

      // Assert
      expect(shouldNavigateToRoot).toBe(false);
    });
  });

  /**
   * @deprecated To be removed in PM-28143. When you remove this, check also if there are any imports/properties
   * in the test setup above that are now un-used and can also be removed.
   */
  describe("changePassword() [PM27086_UpdateAuthenticationApisForInputPassword flag DISABLED]", () => {
    it("should call the postPassword() API method with a the correct PasswordRequest credentials", async () => {
      // Act
      await sut.changePassword(passwordInputResult, userId);

      // Assert
      expect(masterPasswordApiService.postPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          masterPasswordHash: passwordInputResult.currentServerMasterKeyHash,
          masterPasswordHint: passwordInputResult.newPasswordHint,
          newMasterPasswordHash: passwordInputResult.newServerMasterKeyHash,
          key: newMasterKeyEncryptedUserKey[1].encryptedString,
        }),
      );
    });

    it("should call decryptUserKeyWithMasterKey and encryptUserKeyWithMasterKey", async () => {
      // Act
      await sut.changePassword(passwordInputResult, userId);

      // Assert
      expect(masterPasswordService.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        passwordInputResult.currentMasterKey,
        userId,
      );
      expect(keyService.encryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        passwordInputResult.newMasterKey,
        decryptedUserKey,
      );
    });

    it("should throw if a userId was not found", async () => {
      // Arrange
      const userId: null = null;

      // Act
      const testFn = sut.changePassword(passwordInputResult, userId);

      // Assert
      await expect(testFn).rejects.toThrow("userId not found");
    });

    it("should throw if a currentMasterKey was not found", async () => {
      // Arrange
      const incorrectPasswordInputResult = { ...passwordInputResult };
      incorrectPasswordInputResult.currentMasterKey = undefined;

      // Act
      const testFn = sut.changePassword(incorrectPasswordInputResult, userId);

      // Assert
      await expect(testFn).rejects.toThrow(
        "invalid PasswordInputResult credentials, could not change password",
      );
    });

    it("should throw if a currentServerMasterKeyHash was not found", async () => {
      // Arrange
      const incorrectPasswordInputResult = { ...passwordInputResult };
      incorrectPasswordInputResult.currentServerMasterKeyHash = undefined;

      // Act
      const testFn = sut.changePassword(incorrectPasswordInputResult, userId);

      // Assert
      await expect(testFn).rejects.toThrow(
        "invalid PasswordInputResult credentials, could not change password",
      );
    });

    it("should throw an error if user key decryption fails", async () => {
      // Arrange
      masterPasswordService.decryptUserKeyWithMasterKey.mockResolvedValue(null);

      // Act
      const testFn = sut.changePassword(passwordInputResult, userId);

      // Assert
      await expect(testFn).rejects.toThrow("Could not decrypt user key");
    });

    it("should throw an error if postPassword() fails", async () => {
      // Arrange
      masterPasswordApiService.postPassword.mockRejectedValueOnce(new Error("error"));

      // Act
      const testFn = sut.changePassword(passwordInputResult, userId);

      // Assert
      await expect(testFn).rejects.toThrow("Could not change password");
      expect(masterPasswordApiService.postPassword).toHaveBeenCalled();
    });
  });

  /**
   * @deprecated To be removed in PM-28143. When you remove this, check also if there are any imports/properties
   * in the test setup above that are now un-used and can also be removed.
   */
  describe("rotateUserKeyMasterPasswordAndEncryptedData()", () => {
    it("should throw an error (the method is only implemented in Web)", async () => {
      // Act
      const promise = sut.rotateUserKeyMasterPasswordAndEncryptedData(
        "currentPassword",
        "newPassword",
        user,
        "newPasswordHint",
      );

      // Assert
      await expect(promise).rejects.toThrow(
        "rotateUserKeyMasterPasswordAndEncryptedData() is only implemented in Web",
      );
    });
  });

  /**
   * @deprecated To be removed in PM-28143. When you remove this, check also if there are any imports/properties
   * in the test setup above that are now un-used and can also be removed.
   */
  describe("changePasswordForAccountRecovery() [PM27086_UpdateAuthenticationApisForInputPassword flag DISABLED]", () => {
    it("should call the putUpdateTempPassword() API method with the correct UpdateTempPasswordRequest credentials", async () => {
      // Act
      await sut.changePasswordForAccountRecovery(passwordInputResult, userId);

      // Assert
      expect(masterPasswordApiService.putUpdateTempPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          newMasterPasswordHash: passwordInputResult.newServerMasterKeyHash,
          masterPasswordHint: passwordInputResult.newPasswordHint,
          key: newMasterKeyEncryptedUserKey[1].encryptedString,
        }),
      );
    });

    it("should throw an error if user key decryption fails", async () => {
      // Arrange
      masterPasswordService.decryptUserKeyWithMasterKey.mockResolvedValue(null);

      // Act
      const testFn = sut.changePasswordForAccountRecovery(passwordInputResult, userId);

      // Assert
      await expect(testFn).rejects.toThrow("Could not decrypt user key");
    });

    it("should throw an error if putUpdateTempPassword() fails", async () => {
      // Arrange
      masterPasswordApiService.putUpdateTempPassword.mockRejectedValueOnce(new Error("error"));

      // Act
      const testFn = sut.changePasswordForAccountRecovery(passwordInputResult, userId);

      // Assert
      await expect(testFn).rejects.toThrow("Could not change password");
      expect(masterPasswordApiService.putUpdateTempPassword).toHaveBeenCalled();
    });
  });
});
