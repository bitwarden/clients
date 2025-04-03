import { mock, MockProxy } from "jest-mock-extended";

import { MasterPasswordApiService } from "@bitwarden/common/auth/abstractions/master-password-api.service.abstraction";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { KeyService } from "@bitwarden/key-management";

import { ChangePasswordService } from "../../abstractions";

import { DefaultChangePasswordService } from "./default-change-password.service";

describe("DefaultChangePasswordService", () => {
  const userId = "userId" as UserId;

  let accountService: FakeAccountService;
  let keyService: MockProxy<KeyService>;
  let masterPasswordApiService: MockProxy<MasterPasswordApiService>;
  let masterPasswordService: MockProxy<InternalMasterPasswordServiceAbstraction>;

  let sut: ChangePasswordService;

  const currentMasterKey = new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey;
  const currentServerMasterKeyHash = "currentServerMasterKeyHash";

  const newPasswordHint = "newPasswordHint";
  const newMasterKey = new SymmetricCryptoKey(new Uint8Array(32)) as MasterKey;
  const newServerMasterKeyHash = "newServerMasterKeyHash";

  const decryptedUserKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;
  const newMasterKeyEncryptedUserKey: [UserKey, EncString] = [
    decryptedUserKey,
    { encryptedString: "newMasterKeyEncryptedUserKey" } as EncString,
  ];

  beforeEach(() => {
    accountService = mockAccountServiceWith(userId);
    keyService = mock<KeyService>();
    masterPasswordApiService = mock<MasterPasswordApiService>();
    masterPasswordService = mock<InternalMasterPasswordServiceAbstraction>();

    sut = new DefaultChangePasswordService(
      accountService,
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
      await sut.changePassword(
        currentMasterKey,
        currentServerMasterKeyHash,
        newPasswordHint,
        newMasterKey,
        newServerMasterKeyHash,
      );

      // Assert
      expect(masterPasswordApiService.postPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          masterPasswordHash: currentServerMasterKeyHash,
          masterPasswordHint: newPasswordHint,
          newMasterPasswordHash: newServerMasterKeyHash,
          key: newMasterKeyEncryptedUserKey[1].encryptedString,
        }),
      );
    });

    it("should call decryptUserKeyWithMasterKey and encryptUserKeyWithMasterKey", async () => {
      // Act
      await sut.changePassword(
        currentMasterKey,
        currentServerMasterKeyHash,
        newPasswordHint,
        newMasterKey,
        newServerMasterKeyHash,
      );

      // Assert
      expect(masterPasswordService.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        currentMasterKey,
        userId,
      );
      expect(keyService.encryptUserKeyWithMasterKey).toHaveBeenCalledWith(
        newMasterKey,
        decryptedUserKey,
      );
    });

    it("should throw an error if user key decryption fails", async () => {
      // Arrange
      masterPasswordService.decryptUserKeyWithMasterKey.mockResolvedValue(null);

      // Act & Assert
      await expect(
        sut.changePassword(
          currentMasterKey,
          currentServerMasterKeyHash,
          newPasswordHint,
          newMasterKey,
          newServerMasterKeyHash,
        ),
      ).rejects.toThrow("Could not decrypt user key");
    });
  });
});
