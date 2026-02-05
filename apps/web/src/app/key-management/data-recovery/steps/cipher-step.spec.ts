import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { DialogService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { CipherStep } from "./cipher-step";
import { RecoveryWorkingData } from "./recovery-step";

describe("CipherStep", () => {
  let cipherStep: CipherStep;
  let apiService: MockProxy<ApiService>;
  let cipherEncryptionService: MockProxy<CipherEncryptionService>;
  let dialogService: MockProxy<DialogService>;
  let logger: MockProxy<LogRecorder>;

  beforeEach(() => {
    apiService = mock<ApiService>();
    cipherEncryptionService = mock<CipherEncryptionService>();
    dialogService = mock<DialogService>();
    logger = mock<LogRecorder>();

    cipherStep = new CipherStep(apiService, cipherEncryptionService, dialogService);
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
      expect(logger.record).toHaveBeenCalledWith("Cipher ID cipher-2 was undecryptable");
      expect(logger.record).toHaveBeenCalledWith("Cipher ID cipher-3 was undecryptable");
      expect(logger.record).toHaveBeenCalledWith("Found 2 undecryptable ciphers");
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
