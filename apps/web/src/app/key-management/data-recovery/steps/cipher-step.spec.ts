import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { DialogService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { EncryptService, EncString, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { CipherStep } from "./cipher-step";
import { RecoveryWorkingData } from "./recovery-step";

describe("CipherStep", () => {
  let cipherStep: CipherStep;
  let apiService: MockProxy<ApiService>;
  let cipherEncryptionService: MockProxy<CipherEncryptionService>;
  let dialogService: MockProxy<DialogService>;
  let encryptService: MockProxy<EncryptService>;
  let logger: MockProxy<LogRecorder>;

  const userKey = new SymmetricCryptoKey(new Uint8Array(64)) as UserKey;

  beforeEach(() => {
    apiService = mock<ApiService>();
    cipherEncryptionService = mock<CipherEncryptionService>();
    dialogService = mock<DialogService>();
    encryptService = mock<EncryptService>();
    logger = mock<LogRecorder>();

    cipherStep = new CipherStep(apiService, cipherEncryptionService, dialogService, encryptService);
  });

  describe("runDiagnostics", () => {
    it("returns false and logs error when userId is missing", async () => {
      const workingData: RecoveryWorkingData = {
        userId: null,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [],
      };

      const result = await cipherStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Missing user ID");
    });

    it("returns true when all user ciphers are decryptable", async () => {
      const userId = "user-id" as UserId;
      const cipher1 = { id: "cipher-1", organizationId: null } as Cipher;
      const cipher2 = { id: "cipher-2", organizationId: null } as Cipher;

      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [cipher1, cipher2],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockResolvedValue({} as any);

      const result = await cipherStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(cipherEncryptionService.decrypt).toHaveBeenCalledWith(cipher1, userId);
      expect(cipherEncryptionService.decrypt).toHaveBeenCalledWith(cipher2, userId);
    });

    it("filters out organization ciphers (organizationId !== null) and only processes user ciphers", async () => {
      const userId = "user-id" as UserId;
      const userCipher = { id: "user-cipher", organizationId: null } as Cipher;
      const orgCipher1 = { id: "org-cipher-1", organizationId: "org-1" } as Cipher;
      const orgCipher2 = { id: "org-cipher-2", organizationId: "org-2" } as Cipher;

      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [userCipher, orgCipher1, orgCipher2],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockResolvedValue({} as any);

      const result = await cipherStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      // Only user cipher should be processed
      expect(cipherEncryptionService.decrypt).toHaveBeenCalledTimes(1);
      expect(cipherEncryptionService.decrypt).toHaveBeenCalledWith(userCipher, userId);
      // Organization ciphers should not be processed
      expect(cipherEncryptionService.decrypt).not.toHaveBeenCalledWith(orgCipher1, userId);
      expect(cipherEncryptionService.decrypt).not.toHaveBeenCalledWith(orgCipher2, userId);
    });

    it("returns false and records undecryptable user ciphers", async () => {
      const userId = "user-id" as UserId;
      const cipher1 = { id: "cipher-1", organizationId: null } as Cipher;
      const cipher2 = { id: "cipher-2", organizationId: null } as Cipher;
      const cipher3 = { id: "cipher-3", organizationId: null } as Cipher;

      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [cipher1, cipher2, cipher3],
        folders: [],
      };

      cipherEncryptionService.decrypt
        .mockResolvedValueOnce({} as any) // cipher1 succeeds
        .mockRejectedValueOnce(new Error("Decryption failed")) // cipher2 fails
        .mockRejectedValueOnce(new Error("Decryption failed")); // cipher3 fails

      const result = await cipherStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith(
        "Cipher ID cipher-2 was undecryptable (cipher key absent, item type unknown, FIDO2 credentials absent): full decryption failed: Decryption failed",
      );
      expect(logger.record).toHaveBeenCalledWith(
        "Cipher ID cipher-3 was undecryptable (cipher key absent, item type unknown, FIDO2 credentials absent): full decryption failed: Decryption failed",
      );
      expect(logger.record).toHaveBeenCalledWith("Found 2 undecryptable ciphers");
    });

    it("logs that a cipher key is present on an undecryptable cipher", async () => {
      const userId = "user-id" as UserId;
      const cipher = {
        id: "cipher-1",
        organizationId: null,
        key: new EncString("2.key-iv|key-data|key-mac"),
      } as Cipher;

      const workingData: RecoveryWorkingData = {
        userId,
        userKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [cipher],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockRejectedValue(new Error("Decryption failed"));

      await cipherStep.runDiagnostics(workingData, logger);

      expect(logger.record).toHaveBeenCalledWith(
        "Cipher ID cipher-1 was undecryptable (cipher key present, item type unknown, FIDO2 credentials absent): full decryption failed: Decryption failed",
      );
    });

    it("logs the item type and FIDO2 credential state of an undecryptable cipher", async () => {
      const userId = "user-id" as UserId;
      const cipher = {
        id: "cipher-1",
        organizationId: null,
        type: CipherType.Login,
        login: { fido2Credentials: [{}] },
      } as Cipher;

      const workingData: RecoveryWorkingData = {
        userId,
        userKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [cipher],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockRejectedValue(new Error("Decryption failed"));

      await cipherStep.runDiagnostics(workingData, logger);

      expect(logger.record).toHaveBeenCalledWith(
        `Cipher ID cipher-1 was undecryptable (cipher key absent, item type ${CipherType.Login}, FIDO2 credentials present): full decryption failed: Decryption failed`,
      );
    });

    it("returns correct results when running diagnostics multiple times", async () => {
      const userId = "user-id" as UserId;
      const cipher1 = { id: "cipher-1", organizationId: null } as Cipher;
      const cipher2 = { id: "cipher-2", organizationId: null } as Cipher;

      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [cipher1, cipher2],
        folders: [],
      };

      // First run: cipher1 succeeds, cipher2 fails
      cipherEncryptionService.decrypt
        .mockResolvedValueOnce({} as any)
        .mockRejectedValueOnce(new Error("Decryption failed"));

      const result1 = await cipherStep.runDiagnostics(workingData, logger);

      expect(result1).toBe(false);
      expect(cipherStep.canRecover(workingData)).toBe(true);

      // Second run: all ciphers succeed
      cipherEncryptionService.decrypt.mockResolvedValue({} as any);

      const result2 = await cipherStep.runDiagnostics(workingData, logger);

      expect(result2).toBe(true);
      expect(cipherStep.canRecover(workingData)).toBe(false);
      expect(cipherStep["undecryptableCipherIds"]).toHaveLength(0);
      expect(cipherStep["decryptableCipherIds"]).toHaveLength(2);
    });

    describe("name field check", () => {
      const userId = "user-id" as UserId;
      const encryptedName = new EncString("2.name-iv|name-data|name-mac");

      const workingDataFor = (
        cipher: Cipher,
        key: UserKey | null = userKey,
      ): RecoveryWorkingData => ({
        userId,
        userKey: key,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [cipher],
        folders: [],
      });

      beforeEach(() => {
        cipherEncryptionService.decrypt.mockResolvedValue({} as any);
      });

      it("does not probe a cipher with no name", async () => {
        const workingData = workingDataFor({ id: "cipher-1", organizationId: null } as Cipher);

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(true);
        expect(encryptService.decryptString).not.toHaveBeenCalled();
        expect(encryptService.unwrapSymmetricKey).not.toHaveBeenCalled();
      });

      it("does not probe a name that is not an AesCbc256_HmacSha256 encrypted string", async () => {
        const workingData = workingDataFor({
          id: "cipher-1",
          organizationId: null,
          name: new EncString("7.cose-data"),
        } as Cipher);

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(true);
        expect(encryptService.decryptString).not.toHaveBeenCalled();
      });

      it("does not probe when the user key is missing", async () => {
        const workingData = workingDataFor(
          { id: "cipher-1", organizationId: null, name: encryptedName } as Cipher,
          null,
        );

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(true);
        expect(encryptService.decryptString).not.toHaveBeenCalled();
      });

      it("does not probe when the user key is not an AesCbc256_HmacSha256 key", async () => {
        // A COSE user key cannot decrypt an AesCbc256_HmacSha256 name, so the probe would report a
        // failure that says nothing about the cipher.
        const coseUserKey = new SymmetricCryptoKey(new Uint8Array(70)) as UserKey;
        const workingData = workingDataFor(
          { id: "cipher-1", organizationId: null, name: encryptedName } as Cipher,
          coseUserKey,
        );

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(true);
        expect(encryptService.decryptString).not.toHaveBeenCalled();
        expect(encryptService.unwrapSymmetricKey).not.toHaveBeenCalled();
      });

      it("decrypts the name with the user key when the cipher has no cipher key", async () => {
        const workingData = workingDataFor({
          id: "cipher-1",
          organizationId: null,
          name: encryptedName,
        } as Cipher);

        encryptService.decryptString.mockResolvedValue("name");

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(true);
        expect(encryptService.unwrapSymmetricKey).not.toHaveBeenCalled();
        expect(encryptService.decryptString).toHaveBeenCalledWith(encryptedName, userKey);
      });

      it("decrypts the name with the unwrapped cipher key when the cipher has one", async () => {
        const cipherKey = new EncString("2.key-iv|key-data|key-mac");
        const unwrappedKey = new SymmetricCryptoKey(new Uint8Array(64).fill(1));
        const workingData = workingDataFor({
          id: "cipher-1",
          organizationId: null,
          name: encryptedName,
          key: cipherKey,
        } as Cipher);

        encryptService.unwrapSymmetricKey.mockResolvedValue(unwrappedKey);
        encryptService.decryptString.mockResolvedValue("name");

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(true);
        expect(encryptService.unwrapSymmetricKey).toHaveBeenCalledWith(cipherKey, userKey);
        expect(encryptService.decryptString).toHaveBeenCalledWith(encryptedName, unwrappedKey);
      });

      it("flags a cipher whose name fails to decrypt even when full decryption succeeds", async () => {
        const workingData = workingDataFor({
          id: "cipher-1",
          organizationId: null,
          name: encryptedName,
        } as Cipher);

        encryptService.decryptString.mockRejectedValue(new Error("mac mismatch"));

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(false);
        expect(logger.record).toHaveBeenCalledWith(
          "Cipher ID cipher-1 was undecryptable (cipher key absent, item type unknown, FIDO2 credentials absent): name field could not be decrypted: mac mismatch",
        );
      });

      it("flags a cipher whose cipher key cannot be unwrapped", async () => {
        const workingData = workingDataFor({
          id: "cipher-1",
          organizationId: null,
          name: encryptedName,
          key: new EncString("2.key-iv|key-data|key-mac"),
        } as Cipher);

        encryptService.unwrapSymmetricKey.mockRejectedValue(new Error("mac mismatch"));

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(false);
        expect(encryptService.decryptString).not.toHaveBeenCalled();
        expect(logger.record).toHaveBeenCalledWith(
          "Cipher ID cipher-1 was undecryptable (cipher key present, item type unknown, FIDO2 credentials absent): cipher key could not be unwrapped: mac mismatch",
        );
      });

      it("reports both failures when full decryption and the name probe fail", async () => {
        const workingData = workingDataFor({
          id: "cipher-1",
          organizationId: null,
          name: encryptedName,
        } as Cipher);

        cipherEncryptionService.decrypt.mockRejectedValue(new Error("no elements in sequence"));
        encryptService.decryptString.mockRejectedValue(new Error("mac mismatch"));

        const result = await cipherStep.runDiagnostics(workingData, logger);

        expect(result).toBe(false);
        expect(logger.record).toHaveBeenCalledWith(
          "Cipher ID cipher-1 was undecryptable " +
            "(cipher key absent, item type unknown, FIDO2 credentials absent): " +
            "full decryption failed: no elements in sequence; " +
            "name field could not be decrypted: mac mismatch",
        );
      });
    });
  });

  describe("canRecover", () => {
    it("returns false when there are no undecryptable ciphers", async () => {
      const userId = "user-id" as UserId;
      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [
          { id: "cipher-1", organizationId: null } as Cipher,
          { id: "cipher-2", organizationId: null } as Cipher,
        ],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockResolvedValue({} as any);

      await cipherStep.runDiagnostics(workingData, logger);
      const result = cipherStep.canRecover(workingData);

      expect(result).toBe(false);
    });

    it("returns true when there are undecryptable ciphers but at least one decryptable cipher", async () => {
      const userId = "user-id" as UserId;
      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [
          { id: "cipher-1", organizationId: null } as Cipher,
          { id: "cipher-2", organizationId: null } as Cipher,
        ],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockRejectedValueOnce(new Error("Decryption failed"));

      await cipherStep.runDiagnostics(workingData, logger);
      const result = cipherStep.canRecover(workingData);

      expect(result).toBe(true);
    });

    it("returns false when all ciphers are undecryptable", async () => {
      const userId = "user-id" as UserId;
      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [
          { id: "cipher-1", organizationId: null } as Cipher,
          { id: "cipher-2", organizationId: null } as Cipher,
        ],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockRejectedValue(new Error("Decryption failed"));

      await cipherStep.runDiagnostics(workingData, logger);
      const result = cipherStep.canRecover(workingData);

      expect(result).toBe(false);
    });
  });

  describe("runRecovery", () => {
    it("logs and returns early when there are no undecryptable ciphers", async () => {
      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [],
      };

      await cipherStep.runRecovery(workingData, logger);

      expect(logger.record).toHaveBeenCalledWith("No undecryptable ciphers to recover");
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(apiService.deleteCipher).not.toHaveBeenCalled();
    });

    it("throws error when user cancels deletion", async () => {
      const userId = "user-id" as UserId;
      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [{ id: "cipher-1", organizationId: null } as Cipher],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockRejectedValue(new Error("Decryption failed"));
      await cipherStep.runDiagnostics(workingData, logger);

      dialogService.openSimpleDialog.mockResolvedValue(false);

      await expect(cipherStep.runRecovery(workingData, logger)).rejects.toThrow(
        "Cipher recovery cancelled by user",
      );

      expect(logger.record).toHaveBeenCalledWith("Showing confirmation dialog for 1 ciphers");
      expect(logger.record).toHaveBeenCalledWith("User cancelled cipher deletion");
      expect(apiService.deleteCipher).not.toHaveBeenCalled();
    });

    it("deletes undecryptable ciphers when user confirms", async () => {
      const userId = "user-id" as UserId;
      const cipher1 = { id: "cipher-1", organizationId: null } as Cipher;
      const cipher2 = { id: "cipher-2", organizationId: null } as Cipher;

      const workingData: RecoveryWorkingData = {
        userId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [cipher1, cipher2],
        folders: [],
      };

      cipherEncryptionService.decrypt.mockRejectedValue(new Error("Decryption failed"));
      await cipherStep.runDiagnostics(workingData, logger);

      dialogService.openSimpleDialog.mockResolvedValue(true);
      apiService.deleteCipher.mockResolvedValue(undefined);

      await cipherStep.runRecovery(workingData, logger);

      expect(logger.record).toHaveBeenCalledWith("Showing confirmation dialog for 2 ciphers");
      expect(logger.record).toHaveBeenCalledWith("Deleting 2 ciphers");
      expect(apiService.deleteCipher).toHaveBeenCalledWith("cipher-1");
      expect(apiService.deleteCipher).toHaveBeenCalledWith("cipher-2");
      expect(logger.record).toHaveBeenCalledWith("Deleted cipher cipher-1");
      expect(logger.record).toHaveBeenCalledWith("Deleted cipher cipher-2");
      expect(logger.record).toHaveBeenCalledWith("Successfully deleted 2 ciphers");
    });
  });
});
