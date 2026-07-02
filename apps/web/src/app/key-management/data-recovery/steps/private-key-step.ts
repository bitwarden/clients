import { EncryptionType } from "@bitwarden/common/platform/enums";
import { DialogService } from "@bitwarden/components";
import { UserAsymmetricKeysRegenerationService } from "@bitwarden/key-management";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

export class PrivateKeyStep implements RecoveryStep {
  title = "recoveryStepPrivateKeyTitle";

  constructor(
    private privateKeyRegenerationService: UserAsymmetricKeysRegenerationService,
    private dialogService: DialogService,
  ) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    if (!workingData.userId || !workingData.userKey) {
      logger.record("Missing user ID or user key");
      return false;
    }

    try {
      workingData.isPrivateKeyCorrupt = await this.privateKeyRegenerationService.shouldRegenerate(
        workingData.userId,
      );
    } catch {
      return false;
    }

    return !workingData.isPrivateKeyCorrupt;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    // Only support recovery on V1 users.
    return (
      workingData.isPrivateKeyCorrupt &&
      workingData.userKey !== null &&
      workingData.userKey.inner().type === EncryptionType.AesCbc256_HmacSha256_B64
    );
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    // The recovery step is to replace the key pair. Currently, this only works if the user is not using emergency access or is part of an organization.
    // This is because this will break emergency access enrollments / organization memberships / provider memberships.
    logger.record("Showing confirmation dialog for private key replacement");

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "recoveryReplacePrivateKeyTitle" },
      content: { key: "recoveryReplacePrivateKeyDesc" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      logger.record("User cancelled private key replacement");
      throw new Error("Private key recovery cancelled by user");
    }

    logger.record("Replacing private key");
    const recovered =
      await this.privateKeyRegenerationService.regenerateUserPublicKeyEncryptionKeyPair(
        workingData.userId!,
      );
    if (!recovered) {
      logger.record("Private key replacement could not be performed");
    } else {
      logger.record("Private key replacement replaced successfully");
    }
  }
}
