import { mock, MockProxy } from "jest-mock-extended";

import { ChangePasswordService } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { UserId } from "@bitwarden/common/types/guid";
import { KeyService } from "@bitwarden/key-management";
import { UserKeyRotationService } from "@bitwarden/web-vault/app/key-management/key-rotation/user-key-rotation.service";

import { WebChangePasswordService } from "./web-change-password.service";

describe("WebChangePasswordService", () => {
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;
  let userKeyRotationService: MockProxy<UserKeyRotationService>;

  let sut: ChangePasswordService;

  const userId = "userId" as UserId;
  const user: Account = {
    id: userId,
    email: "email",
    emailVerified: false,
    name: "name",
  };

  const currentPassword = "currentPassword";
  const newPassword = "newPassword";
  const newPasswordHint = "newPasswordHint";

  beforeEach(() => {
    keyService = mock<KeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();
    userKeyRotationService = mock<UserKeyRotationService>();

    sut = new WebChangePasswordService(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
      userKeyRotationService,
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
