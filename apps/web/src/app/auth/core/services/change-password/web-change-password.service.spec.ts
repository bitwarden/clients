import { mock, MockProxy } from "jest-mock-extended";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { MasterPasswordUnlockService } from "@bitwarden/common/key-management/master-password/abstractions/master-password-unlock.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { SyncService } from "@bitwarden/common/platform/sync";
import { mockAccountInfoWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
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

  let sut: WebChangePasswordService;

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
    it("should call userKeyRotationService.rotateUserKeyMasterPasswordAndEncryptedData with the correct arguments", async () => {
      // Act
      // Use `as any` because rotate method is protected
      await (sut as any).rotateUserKeyMasterPasswordAndEncryptedData(
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

  describe("rotateUserKeyMasterPasswordAndEncryptedDataOld()", () => {
    it("should call the method with the same name on the UserKeyRotationService with the correct arguments", async () => {
      // Arrange & Act
      await sut.rotateUserKeyMasterPasswordAndEncryptedDataOld(
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
});
