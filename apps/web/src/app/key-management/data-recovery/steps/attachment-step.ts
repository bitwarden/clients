import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

/**
 * Detects old attachments: attachments without their own key, which are encrypted directly with the
 * user key. They block user key rotation and have to be re-uploaded from the vault item.
 */
export class AttachmentStep implements RecoveryStep {
  title = "recoveryStepAttachmentTitle";
  message?: string;

  oldAttachmentCipherIds: string[] = [];

  constructor(private i18nService: I18nService) {}

  runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    this.oldAttachmentCipherIds = [];
    this.message = undefined;

    // Attachments of organization ciphers are encrypted with the organization key, which this tool
    // does not handle. This mirrors the scope of CipherStep.
    const userCiphers = workingData.ciphers.filter((c) => c.organizationId == null);

    for (const cipher of userCiphers) {
      if (!(cipher.attachments ?? []).some((a) => a.key == null)) {
        continue;
      }

      logger.record(`Cipher ID ${cipher.id} has old attachments`);
      this.oldAttachmentCipherIds.push(cipher.id);
    }

    logger.record(`Found ${this.oldAttachmentCipherIds.length} ciphers with old attachments`);

    if (this.oldAttachmentCipherIds.length === 0) {
      return Promise.resolve(true);
    }

    this.message = this.i18nService.t(
      "recoveryStepAttachmentIssue",
      this.oldAttachmentCipherIds.length.toString(),
    );
    return Promise.resolve(false);
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    // Old attachments are repaired from the vault item itself, not from this tool.
    return false;
  }

  runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    return Promise.resolve();
  }
}
