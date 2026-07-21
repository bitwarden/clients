import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { DialogService } from "@bitwarden/components";

import { LogRecorder } from "../log-recorder";

import { logCipherCorruption } from "./corruption-log";
import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

interface CorruptAttachment {
  cipherId: string;
  attachmentId: string;
}

/**
 * Detects attachments whose key or filename fail to decrypt (surfaced as
 * `AttachmentView.hasDecryptionError`) and repairs them by deleting the corrupt attachments.
 */
export class AttachmentStep implements RecoveryStep {
  title = "recoveryStepAttachmentsTitle";

  private corruptAttachments: CorruptAttachment[] = [];

  constructor(
    private cipherService: CipherEncryptionService,
    private apiService: ApiService,
    private dialogService: DialogService,
  ) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    if (!workingData.userId) {
      logger.record("Missing user ID");
      return false;
    }

    this.corruptAttachments = [];

    const userCiphers = workingData.ciphers.filter((c) => c.organizationId == null);
    for (const cipher of userCiphers) {
      let view;
      try {
        view = await this.cipherService.decrypt(cipher, workingData.userId);
      } catch {
        // Whole-cipher (or FIDO2) decryption failures are handled by other steps.
        continue;
      }

      const corrupt = view.attachments?.filter((a) => a.hasDecryptionError && a.id != null) ?? [];
      for (const attachment of corrupt) {
        this.corruptAttachments.push({ cipherId: cipher.id, attachmentId: attachment.id! });
        logCipherCorruption(cipher, logger, `attachment ${attachment.id}`);
      }
    }

    logger.record(`Found ${this.corruptAttachments.length} corrupt attachments`);

    return this.corruptAttachments.length == 0;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    return this.corruptAttachments.length > 0;
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    if (this.corruptAttachments.length === 0) {
      logger.record("No corrupt attachments to recover");
      return;
    }

    logger.record(`Showing confirmation dialog for ${this.corruptAttachments.length} attachments`);

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "recoveryDeleteAttachmentsTitle" },
      content: { key: "recoveryDeleteAttachmentsDesc" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      logger.record("User cancelled attachment deletion");
      throw new Error("Attachment recovery cancelled by user");
    }

    logger.record(`Deleting ${this.corruptAttachments.length} attachments`);

    for (const { cipherId, attachmentId } of this.corruptAttachments) {
      try {
        await this.apiService.deleteCipherAttachment(cipherId, attachmentId);
        logger.record(`Deleted attachment ${attachmentId} from cipher ${cipherId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.record(
          `Failed to delete attachment ${attachmentId} from cipher ${cipherId}: ${errorMessage}`,
        );
        throw error;
      }
    }

    logger.record(`Successfully deleted ${this.corruptAttachments.length} attachments`);
  }
}
