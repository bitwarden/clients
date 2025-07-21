import { mock, MockProxy } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PasswordInputResult } from "@bitwarden/auth/angular";
import { Account } from "@bitwarden/common/auth/abstractions/account.service";
import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { KeyService, PBKDF2KdfConfig } from "@bitwarden/key-management";

import { ChangePasswordService } from "./change-password.service.abstraction";
import { DefaultChangePasswordService } from "./default-change-password.service";

describe("DefaultChangePasswordService", () => {
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;

  let sut: ChangePasswordService;

  const userId = "userId" as UserId;

  const user: Account = {
    id: userId,
    email: "email",
    emailVerified: false,
    name: "name",
  };

  const passwordInputResult: PasswordInputResult = {
    currentMasterKey: new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
    currentServerMasterKeyHash: "currentServerMasterKeyHash",

    newPassword: "newPassword",
    newPasswordHint: "newPasswordHint",
    newMasterKey: new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey,
    newServerMasterKeyHash: "newServerMasterKeyHash",
    newLocalMasterKeyHash: "newLocalMasterKeyHash",

    kdfConfig: new PBKDF2KdfConfig(),
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

    sut = new DefaultChangePasswordService(
      keyService,
      masterPasswordApiService,
      masterPasswordService,
    );

    masterPasswordService.decryptUserKeyWithMasterKey.mockResolvedValue(decryptedUserKey);
    keyService.encryptUserKeyWithMasterKey.mockResolvedValue(newMasterKeyEncryptedUserKey);
  });

  describe("changePassword()", () => {
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

  describe("rotateUserKeyMasterPasswordAndEncryptedData()", () => {
    it("should throw an error (the method is only implemented in Web)", async () => {
      // Act
      const testFn = sut.rotateUserKeyMasterPasswordAndEncryptedData(
        "currentPassword",
        "newPassword",
        user,
        "newPasswordHint",
      );

      // Assert
      await expect(testFn).rejects.toThrow(
        "rotateUserKeyMasterPasswordAndEncryptedData() is only implemented in Web",
      );
    });
  });

  describe("changePasswordForAccountRecovery()", () => {
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
