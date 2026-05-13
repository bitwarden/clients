import { mock, MockProxy } from "jest-mock-extended";
import { of } from "rxjs";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { PasswordRequest } from "@bitwarden/common/auth/models/request/password.request";
import { UpdateTempPasswordRequest } from "@bitwarden/common/auth/models/request/update-temp-password.request";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import {
  MasterKeyWrappedUserKey,
  MasterPasswordAuthenticationData,
  MasterPasswordAuthenticationHash,
  MasterPasswordSalt,
  MasterPasswordUnlockData,
} from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { makeSymmetricCryptoKey, mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { DEFAULT_KDF_CONFIG, KeyService } from "@bitwarden/key-management";

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

  describe("changePassword() and changePasswordForAccountRecovery()", () => {
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
      };

      // Mock method data
      userKey = makeSymmetricCryptoKey(64) as UserKey;

      newAuthenticationData = {
        salt: passwordInputResult.salt!,
        kdf: passwordInputResult.kdfConfig!,
        masterPasswordAuthenticationHash:
          "newMasterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
      };

      newUnlockData = {
        salt: passwordInputResult.salt!,
        kdf: passwordInputResult.kdfConfig!,
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
          salt: passwordInputResult.salt!,
          kdf: passwordInputResult.kdfConfig!,
          masterPasswordAuthenticationHash:
            "currentMasterPasswordAuthenticationHash" as MasterPasswordAuthenticationHash,
        };

        request = PasswordRequest.newConstructor(
          currentAuthenticationData.masterPasswordAuthenticationHash,
          newAuthenticationData,
          newUnlockData,
          passwordInputResult.newPasswordHint!,
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
        request = new UpdateTempPasswordRequest(
          newAuthenticationData,
          newUnlockData,
          passwordInputResult.newPasswordHint!,
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
});
