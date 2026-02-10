import { mock, MockProxy } from "jest-mock-extended";

import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
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
    userKeyRotationService = mock<UserKeyRotationService>();
    routerService = mock<RouterService>();

    sut = new WebChangePasswordService(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      userKeyRotationService,
      routerService,
    );
  });

  describe("rotateUserKeyMasterPasswordAndEncryptedData()", () => {
    it("should call the method with the same name on the UserKeyRotationService with the correct arguments", async () => {
      // Arrange & Act
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
});
