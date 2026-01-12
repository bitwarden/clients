import { mock, MockProxy } from "jest-mock-extended";

import { UserKey } from "@bitwarden/common/types/key";
import { FolderApiServiceAbstraction } from "@bitwarden/common/vault/abstractions/folder/folder-api.service.abstraction";
import { Folder } from "@bitwarden/common/vault/models/domain/folder";
import { DialogService } from "@bitwarden/components";
import { PureCrypto } from "@bitwarden/sdk-internal";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { FolderStep } from "./folder-step";
import { RecoveryWorkingData } from "./recovery-step";

// Mock SdkLoadService
jest.mock("@bitwarden/common/platform/abstractions/sdk/sdk-load.service", () => ({
  SdkLoadService: {
    Ready: Promise.resolve(),
  },
}));

jest.mock("@bitwarden/sdk-internal", () => ({
  PureCrypto: {
    symmetric_decrypt_string: jest.fn(),
  },
}));

describe("FolderStep", () => {
  let folderStep: FolderStep;
  let folderService: MockProxy<FolderApiServiceAbstraction>;
  let dialogService: MockProxy<DialogService>;
  let logger: MockProxy<LogRecorder>;

  const mockUserKey = {
    toEncoded: jest.fn().mockReturnValue("encoded-user-key"),
  } as unknown as UserKey;

  beforeEach(() => {
    folderService = mock<FolderApiServiceAbstraction>();
    dialogService = mock<DialogService>();
    logger = mock<LogRecorder>();

    folderStep = new FolderStep(folderService, dialogService);

    jest.clearAllMocks();
  });

  describe("runDiagnostics", () => {
    it("returns false and logs error when userKey is missing", async () => {
      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: null,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [],
      };

      const result = await folderStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Missing user key");
    });

    it("returns true when all folders are decryptable", async () => {
      const folder1 = { id: "folder-1", name: { encryptedString: "encrypted-name-1" } };
      const folder2 = { id: "folder-2", name: { encryptedString: "encrypted-name-2" } };

      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [folder1, folder2] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockReturnValue("decrypted-name");

      const result = await folderStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(PureCrypto.symmetric_decrypt_string).toHaveBeenCalledWith(
        "encrypted-name-1",
        "encoded-user-key",
      );
      expect(PureCrypto.symmetric_decrypt_string).toHaveBeenCalledWith(
        "encrypted-name-2",
        "encoded-user-key",
      );
      expect(logger.record).toHaveBeenCalledWith("Found 0 undecryptable folders");
      expect(logger.record).toHaveBeenCalledWith("Found 2 decryptable folders");
    });

    it("returns false and records folders with no name", async () => {
      const folder1 = { id: "folder-1", name: { encryptedString: "encrypted-name-1" } };
      const folder2 = { id: "folder-2", name: null as null };
      const folder3 = { id: "folder-3", name: { encryptedString: null as null } };

      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [folder1, folder2, folder3] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockReturnValue("decrypted-name");

      const result = await folderStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Folder ID folder-2 has no name");
      expect(logger.record).toHaveBeenCalledWith("Folder ID folder-3 has no name");
      expect(logger.record).toHaveBeenCalledWith("Found 2 undecryptable folders");
      expect(logger.record).toHaveBeenCalledWith("Found 1 decryptable folders");
    });

    it("returns false and records undecryptable folders", async () => {
      const folder1 = { id: "folder-1", name: { encryptedString: "encrypted-name-1" } };
      const folder2 = { id: "folder-2", name: { encryptedString: "encrypted-name-2" } };
      const folder3 = { id: "folder-3", name: { encryptedString: "encrypted-name-3" } };

      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [folder1, folder2, folder3] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock)
        .mockReturnValueOnce("decrypted-name") // folder1 succeeds
        .mockImplementationOnce(() => {
          throw new Error("Decryption failed");
        }) // folder2 fails
        .mockImplementationOnce(() => {
          throw new Error("Decryption failed");
        }); // folder3 fails

      const result = await folderStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith(
        "Folder name for folder ID folder-2 was undecryptable",
      );
      expect(logger.record).toHaveBeenCalledWith(
        "Folder name for folder ID folder-3 was undecryptable",
      );
      expect(logger.record).toHaveBeenCalledWith("Found 2 undecryptable folders");
      expect(logger.record).toHaveBeenCalledWith("Found 1 decryptable folders");
    });

    it("returns correct results when running diagnostics multiple times", async () => {
      const folder1 = { id: "folder-1", name: { encryptedString: "encrypted-name-1" } };
      const folder2 = { id: "folder-2", name: { encryptedString: "encrypted-name-2" } };

      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [folder1, folder2] as Folder[],
      };

      // First run: folder1 succeeds, folder2 fails
      (PureCrypto.symmetric_decrypt_string as jest.Mock)
        .mockReturnValueOnce("decrypted-name")
        .mockImplementationOnce(() => {
          throw new Error("Decryption failed");
        });

      const result1 = await folderStep.runDiagnostics(workingData, logger);

      expect(result1).toBe(false);
      expect(folderStep.canRecover(workingData)).toBe(true);

      // Second run: all folders succeed
      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockReturnValue("decrypted-name");

      const result2 = await folderStep.runDiagnostics(workingData, logger);

      expect(result2).toBe(true);
      expect(folderStep.canRecover(workingData)).toBe(false);
      expect(folderStep["undecryptableFolderIds"]).toEqual([]);
      expect(folderStep["decryptableFolderIds"]).toEqual(["folder-1", "folder-2"]);
    });
  });

  describe("canRecover", () => {
    it("returns false when there are no undecryptable folders", async () => {
      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [
          { id: "folder-1", name: { encryptedString: "encrypted-name-1" } },
          { id: "folder-2", name: { encryptedString: "encrypted-name-2" } },
        ] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockReturnValue("decrypted-name");

      await folderStep.runDiagnostics(workingData, logger);
      const result = folderStep.canRecover(workingData);

      expect(result).toBe(false);
    });

    it("returns true when there are undecryptable folders but at least one decryptable folder", async () => {
      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [
          { id: "folder-1", name: { encryptedString: "encrypted-name-1" } },
          { id: "folder-2", name: { encryptedString: "encrypted-name-2" } },
        ] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock)
        .mockReturnValueOnce("decrypted-name")
        .mockImplementationOnce(() => {
          throw new Error("Decryption failed");
        });

      await folderStep.runDiagnostics(workingData, logger);
      const result = folderStep.canRecover(workingData);

      expect(result).toBe(true);
    });

    it("returns false when all folders are undecryptable", async () => {
      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [
          { id: "folder-1", name: { encryptedString: "encrypted-name-1" } },
          { id: "folder-2", name: { encryptedString: "encrypted-name-2" } },
        ] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockImplementation(() => {
        throw new Error("Decryption failed");
      });

      await folderStep.runDiagnostics(workingData, logger);
      const result = folderStep.canRecover(workingData);

      expect(result).toBe(false);
    });
  });

  describe("runRecovery", () => {
    it("logs and returns early when there are no undecryptable folders", async () => {
      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [],
      };

      await folderStep.runRecovery(workingData, logger);

      expect(logger.record).toHaveBeenCalledWith("No undecryptable folders to recover");
      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(folderService.delete).not.toHaveBeenCalled();
    });

    it("throws error when userId is missing", async () => {
      const folder1 = { id: "folder-1", name: { encryptedString: "encrypted-name-1" } };

      const workingData: RecoveryWorkingData = {
        userId: "user-id" as UserId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [folder1] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockImplementation(() => {
        throw new Error("Decryption failed");
      });
      await folderStep.runDiagnostics(workingData, logger);

      // Now set userId to null for recovery
      workingData.userId = null;

      await expect(folderStep.runRecovery(workingData, logger)).rejects.toThrow("Missing user ID");
      expect(logger.record).toHaveBeenCalledWith("Missing user ID");
    });

    it("throws error when user cancels deletion", async () => {
      const userId = "user-id" as UserId;
      const folder1 = { id: "folder-1", name: { encryptedString: "encrypted-name-1" } };

      const workingData: RecoveryWorkingData = {
        userId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [folder1] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockImplementation(() => {
        throw new Error("Decryption failed");
      });
      await folderStep.runDiagnostics(workingData, logger);

      dialogService.openSimpleDialog.mockResolvedValue(false);

      await expect(folderStep.runRecovery(workingData, logger)).rejects.toThrow(
        "Folder recovery cancelled by user",
      );

      expect(logger.record).toHaveBeenCalledWith("Showing confirmation dialog for 1 folders");
      expect(logger.record).toHaveBeenCalledWith("User cancelled folder deletion");
      expect(folderService.delete).not.toHaveBeenCalled();
    });

    it("deletes undecryptable folders when user confirms", async () => {
      const userId = "user-id" as UserId;
      const folder1 = { id: "folder-1", name: { encryptedString: "encrypted-name-1" } };
      const folder2 = { id: "folder-2", name: { encryptedString: "encrypted-name-2" } };

      const workingData: RecoveryWorkingData = {
        userId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [folder1, folder2] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockImplementation(() => {
        throw new Error("Decryption failed");
      });
      await folderStep.runDiagnostics(workingData, logger);

      dialogService.openSimpleDialog.mockResolvedValue(true);
      folderService.delete.mockResolvedValue(undefined);

      await folderStep.runRecovery(workingData, logger);

      expect(logger.record).toHaveBeenCalledWith("Showing confirmation dialog for 2 folders");
      expect(logger.record).toHaveBeenCalledWith("Deleting 2 folders");
      expect(folderService.delete).toHaveBeenCalledWith("folder-1", userId);
      expect(folderService.delete).toHaveBeenCalledWith("folder-2", userId);
      expect(logger.record).toHaveBeenCalledWith("Deleted folder folder-1");
      expect(logger.record).toHaveBeenCalledWith("Deleted folder folder-2");
      expect(logger.record).toHaveBeenCalledWith("Successfully deleted 2 folders");
    });

    it("continues deleting folders even if some deletions fail", async () => {
      const userId = "user-id" as UserId;
      const folder1 = { id: "folder-1", name: { encryptedString: "encrypted-name-1" } };
      const folder2 = { id: "folder-2", name: { encryptedString: "encrypted-name-2" } };
      const folder3 = { id: "folder-3", name: { encryptedString: "encrypted-name-3" } };

      const workingData: RecoveryWorkingData = {
        userId,
        userKey: mockUserKey,
        encryptedPrivateKey: null,
        isPrivateKeyCorrupt: false,
        ciphers: [],
        folders: [folder1, folder2, folder3] as Folder[],
      };

      (PureCrypto.symmetric_decrypt_string as jest.Mock).mockImplementation(() => {
        throw new Error("Decryption failed");
      });
      await folderStep.runDiagnostics(workingData, logger);

      dialogService.openSimpleDialog.mockResolvedValue(true);
      folderService.delete
        .mockResolvedValueOnce(undefined) // folder1 succeeds
        .mockRejectedValueOnce(new Error("Network error")) // folder2 fails
        .mockResolvedValueOnce(undefined); // folder3 succeeds

      await folderStep.runRecovery(workingData, logger);

      expect(folderService.delete).toHaveBeenCalledTimes(3);
      expect(logger.record).toHaveBeenCalledWith("Deleted folder folder-1");
      expect(logger.record).toHaveBeenCalledWith(
        "Failed to delete folder folder-2: Error: Network error",
      );
      expect(logger.record).toHaveBeenCalledWith("Deleted folder folder-3");
    });
  });
});
