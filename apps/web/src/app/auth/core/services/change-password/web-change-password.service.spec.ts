import { mock, MockProxy } from "jest-mock-extended";

import {
  ChangePasswordService,
  InvalidCurrentPasswordError,
} from "@bitwarden/angular/auth/password-management/change-password";
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { LogoutService } from "@bitwarden/common/auth/logout";
import { OrganizationInviteService } from "@bitwarden/common/auth/organization-invite";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { MasterPasswordSalt } from "@bitwarden/common/key-management/master-password/types/master-password.types";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";
// eslint-disable-next-line no-restricted-imports
import { DEFAULT_KDF_CONFIG } from "@bitwarden/legacy-crypto";
import { UserKeyRotationServiceAbstraction } from "@bitwarden/user-crypto-management";
import { RouterService } from "@bitwarden/web-vault/app/core";

import { WebChangePasswordService } from "./web-change-password.service";

describe("WebChangePasswordService", () => {
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let masterPasswordUnlockService: MockProxy<MasterPasswordUnlockService>;
  let policyService: MockProxy<PolicyService>;
  let organizationInviteService: MockProxy<OrganizationInviteService>;
  let syncService: MockProxy<SyncService>;
  let userKeyRotationService: MockProxy<UserKeyRotationServiceAbstraction>;
  let routerService: MockProxy<RouterService>;
  let toastService: MockProxy<ToastService>;
  let i18nService: MockProxy<I18nService>;
  let logoutService: MockProxy<LogoutService>;

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
    policyService = mock<PolicyService>();
    organizationInviteService = mock<OrganizationInviteService>();
    syncService = mock<SyncService>();
    userKeyRotationService = mock<UserKeyRotationServiceAbstraction>();
    routerService = mock<RouterService>();
    toastService = mock<ToastService>();
    i18nService = mock<I18nService>();
    logoutService = mock<LogoutService>();

    sut = new WebChangePasswordService(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      masterPasswordUnlockService,
      policyService,
      organizationInviteService,
      syncService,
      userKeyRotationService,
      routerService,
      toastService,
      i18nService,
      logoutService,
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

    it("should throw if newPasswordHint is undefined on the PasswordInputResult object", async () => {
      // Arrange
      const invalidPasswordInputResult: PasswordInputResult = {
        ...passwordInputResult,
        newPasswordHint: undefined,
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

    it("should call userKeyRotationService.changePasswordAndRotateUserKey() with the correct arguments", async () => {
      // Act
      await sut.changePasswordAndRotateUserKey(passwordInputResult, user);

      // Assert
      expect(userKeyRotationService.changePasswordAndRotateUserKey).toHaveBeenCalledWith(
        passwordInputResult.currentPassword,
        passwordInputResult.newPassword,
        passwordInputResult.newPasswordHint,
        user.id,
      );
    });

    it("should show a toast and log out when the rotation succeeds", async () => {
      // Arrange
      userKeyRotationService.changePasswordAndRotateUserKey.mockResolvedValue(true);

      // Act
      await sut.changePasswordAndRotateUserKey(passwordInputResult, user);

      // Assert
      expect(toastService.showToast).toHaveBeenCalledWith(
        expect.objectContaining({ variant: "success" }),
      );
      expect(logoutService.logout).toHaveBeenCalledWith(user.id, "userKeyRotation");
    });

    it("should neither show a toast nor log out when the rotation does not happen", async () => {
      // Arrange
      userKeyRotationService.changePasswordAndRotateUserKey.mockResolvedValue(false);

      // Act
      await sut.changePasswordAndRotateUserKey(passwordInputResult, user);

      // Assert
      expect(toastService.showToast).not.toHaveBeenCalled();
      expect(logoutService.logout).not.toHaveBeenCalled();
    });
  });
});
