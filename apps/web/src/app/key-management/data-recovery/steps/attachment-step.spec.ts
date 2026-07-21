import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { AttachmentStep } from "./attachment-step";
import { RecoveryWorkingData } from "./recovery-step";

function attachment(id: string, hasDecryptionError: boolean): AttachmentView {
  const view = new AttachmentView();
  view.id = id;
  view.hasDecryptionError = hasDecryptionError;
  return view;
}

function viewWithAttachments(attachments: AttachmentView[]): CipherView {
  return { decryptionFailure: false, attachments } as CipherView;
}

function buildWorkingData(ciphers: Cipher[]): RecoveryWorkingData {
  return {
    userId: "user-id" as UserId,
    userKey: null,
    encryptedPrivateKey: null,
    isPrivateKeyCorrupt: false,
    ciphers,
    folders: [],
    fido2CorruptCipherIds: [],
  };
}

describe("AttachmentStep", () => {
  let attachmentStep: AttachmentStep;
  let cipherEncryptionService: MockProxy<CipherEncryptionService>;
  let apiService: MockProxy<ApiService>;
  let dialogService: MockProxy<DialogService>;
  let logger: MockProxy<LogRecorder>;

  beforeEach(() => {
    cipherEncryptionService = mock<CipherEncryptionService>();
    apiService = mock<ApiService>();
    dialogService = mock<DialogService>();
    logger = mock<LogRecorder>();

    attachmentStep = new AttachmentStep(cipherEncryptionService, apiService, dialogService);
  });

  describe("runDiagnostics", () => {
    it("returns false and logs when userId is missing", async () => {
      const workingData = buildWorkingData([]);
      workingData.userId = null;

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(logger.record).toHaveBeenCalledWith("Missing user ID");
    });

    it("returns true when no attachments have decryption errors", async () => {
      const cipher = { id: "cipher-1", organizationId: null } as Cipher;
      const workingData = buildWorkingData([cipher]);

      cipherEncryptionService.decrypt.mockResolvedValue(
        viewWithAttachments([attachment("att-1", false)]),
      );

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
    });

    it("records attachments with decryption errors", async () => {
      const cipher = { id: "cipher-1", organizationId: null } as Cipher;
      const workingData = buildWorkingData([cipher]);

      cipherEncryptionService.decrypt.mockResolvedValue(
        viewWithAttachments([attachment("att-good", false), attachment("att-bad", true)]),
      );

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(false);
      expect(attachmentStep["corruptAttachments"]).toEqual([
        { cipherId: "cipher-1", attachmentId: "att-bad" },
      ]);
      expect(logger.record).toHaveBeenCalledWith("Found 1 corrupt attachments");
    });

    it("skips ciphers that fail to decrypt entirely", async () => {
      const cipher = { id: "cipher-1", organizationId: null } as Cipher;
      const workingData = buildWorkingData([cipher]);

      cipherEncryptionService.decrypt.mockRejectedValue(new Error("Decryption failed"));

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(attachmentStep["corruptAttachments"]).toEqual([]);
    });

    it("skips organization ciphers", async () => {
      const orgCipher = { id: "org-cipher", organizationId: "org-1" } as Cipher;
      const workingData = buildWorkingData([orgCipher]);

      const result = await attachmentStep.runDiagnostics(workingData, logger);

      expect(result).toBe(true);
      expect(cipherEncryptionService.decrypt).not.toHaveBeenCalled();
    });
  });

  describe("canRecover", () => {
    it("returns true only when corrupt attachments were found", async () => {
      const cipher = { id: "cipher-1", organizationId: null } as Cipher;
      const workingData = buildWorkingData([cipher]);

      cipherEncryptionService.decrypt.mockResolvedValue(
        viewWithAttachments([attachment("att-bad", true)]),
      );
      await attachmentStep.runDiagnostics(workingData, logger);

      expect(attachmentStep.canRecover(workingData)).toBe(true);
    });
  });

  describe("runRecovery", () => {
    it("returns early when there is nothing to recover", async () => {
      const workingData = buildWorkingData([]);

      await attachmentStep.runRecovery(workingData, logger);

      expect(dialogService.openSimpleDialog).not.toHaveBeenCalled();
      expect(apiService.deleteCipherAttachment).not.toHaveBeenCalled();
    });

    it("throws when the user cancels", async () => {
      const cipher = { id: "cipher-1", organizationId: null } as Cipher;
      const workingData = buildWorkingData([cipher]);
      cipherEncryptionService.decrypt.mockResolvedValue(
        viewWithAttachments([attachment("att-bad", true)]),
      );
      await attachmentStep.runDiagnostics(workingData, logger);

      dialogService.openSimpleDialog.mockResolvedValue(false);

      await expect(attachmentStep.runRecovery(workingData, logger)).rejects.toThrow(
        "Attachment recovery cancelled by user",
      );
      expect(apiService.deleteCipherAttachment).not.toHaveBeenCalled();
    });

    it("deletes corrupt attachments when confirmed", async () => {
      const cipher = { id: "cipher-1", organizationId: null } as Cipher;
      const workingData = buildWorkingData([cipher]);
      cipherEncryptionService.decrypt.mockResolvedValue(
        viewWithAttachments([attachment("att-bad", true)]),
      );
      await attachmentStep.runDiagnostics(workingData, logger);

      dialogService.openSimpleDialog.mockResolvedValue(true);
      apiService.deleteCipherAttachment.mockResolvedValue(undefined as any);

      await attachmentStep.runRecovery(workingData, logger);

      expect(apiService.deleteCipherAttachment).toHaveBeenCalledWith("cipher-1", "att-bad");
      expect(logger.record).toHaveBeenCalledWith("Deleted attachment att-bad from cipher cipher-1");
    });
  });
});
