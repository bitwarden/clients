import { mock, MockProxy } from "jest-mock-extended";

import {
  ChangePasswordService,
  InvalidCurrentPasswordError,
} from "@bitwarden/angular/auth/password-management/change-password";
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { DEFAULT_KDF_CONFIG, KeyService } from "@bitwarden/key-management";
import { RouterService } from "@bitwarden/web-vault/app/core";
import { UserKeyRotationService } from "@bitwarden/web-vault/app/key-management/key-rotation/user-key-rotation.service";

import { WebChangePasswordService } from "./web-change-password.service";

describe("WebChangePasswordService", () => {
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let masterPasswordUnlockService: MockProxy<MasterPasswordUnlockService>;
  let syncService: MockProxy<SyncService>;
  let userKeyRotationService: MockProxy<UserKeyRotationService>;
  let routerService: MockProxy<RouterService>;

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

  const currentPassword = "currentPassword";
  const newPassword = "newPassword";
  const newPasswordHint = "newPasswordHint";

  beforeEach(() => {
    keyService = mock<KeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    masterPasswordUnlockService = mock<MasterPasswordUnlockService>();
    syncService = mock<SyncService>();
    userKeyRotationService = mock<UserKeyRotationService>();
    routerService = mock<RouterService>();

    sut = new WebChangePasswordService(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      masterPasswordUnlockService,
      syncService,
      userKeyRotationService,
      routerService,
    );
  });

  describe("rotateUserKeyMasterPasswordAndEncryptedData()", () => {
    it("should call the method with the same name on the UserKeyRotationService with the correct arguments", async () => {
      // Act
      await sut.rotateUserKeyMasterPasswordAndEncryptedData(
        currentPassword,
        newPassword,
        user,
        newPasswordHint,
      );

      // Assert
      expect(
        userKeyRotationService.rotateUserKeyMasterPasswordAndEncryptedData,
      ).toHaveBeenCalledWith(currentPassword, newPassword, user, newPasswordHint);
    });
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

      // Mock returned/resolved values
      masterPasswordUnlockService.proofOfDecryption.mockResolvedValue(true);
      syncService.fullSync.mockResolvedValue(true);
    });

    ["currentPassword", "newPassword"].forEach((key) => {
      it(`should throw if ${key} is an empty string (falsy) on the PasswordInputResult object`, async () => {
        // Arrange
        const invalidPasswordInputResult: PasswordInputResult = {
          ...passwordInputResult,
          [key]: "",
        };

        // Act
        const promise = sut.changePasswordAndRotateUserKey(invalidPasswordInputResult, user);

        // Assert
        await expect(promise).rejects.toThrow(
          `${key} is falsy. Could not change password and rotate user key.`,
        );
      });
    });

    it("should throw if newPasswordHint is null on the PasswordInputResult object", async () => {
      // Arrange
      const invalidPasswordInputResult: PasswordInputResult = {
        ...passwordInputResult,
        newPasswordHint: null,
      };

      // Act
      const promise = sut.changePasswordAndRotateUserKey(invalidPasswordInputResult, user);

      // Assert
      await expect(promise).rejects.toThrow(
        "newPasswordHint is null or undefined. Could not change password and rotate user key.",
      );
    });

    it("should throw if the current password is invalid (proofOfDecryption failed)", async () => {
      // Arrange
      masterPasswordUnlockService.proofOfDecryption.mockResolvedValue(false);

      // Act
      const promise = sut.changePasswordAndRotateUserKey(passwordInputResult, user);

      // Assert
      await expect(promise).rejects.toThrow(InvalidCurrentPasswordError);
    });

    it("should call proofOfDecryption with the entered current password", async () => {
      // Act
      await sut.changePasswordAndRotateUserKey(passwordInputResult, user);

      // Assert
      expect(masterPasswordUnlockService.proofOfDecryption).toHaveBeenCalledWith(
        passwordInputResult.currentPassword,
        user.id,
      );
    });

    it("should call a fullSync", async () => {
      // Act
      await sut.changePasswordAndRotateUserKey(passwordInputResult, user);

      // Assert
      expect(syncService.fullSync).toHaveBeenCalledWith(true);
    });

    it("should call userKeyRotationService.rotateUserKeyMasterPasswordAndEncryptedData() with the correct arguments", async () => {
      // Act
      await sut.changePasswordAndRotateUserKey(passwordInputResult, user);

      // Assert
      expect(
        userKeyRotationService.rotateUserKeyMasterPasswordAndEncryptedData,
      ).toHaveBeenCalledWith(
        passwordInputResult.currentPassword,
        passwordInputResult.newPassword,
        user,
        passwordInputResult.newPasswordHint,
      );
    });
  });
});
