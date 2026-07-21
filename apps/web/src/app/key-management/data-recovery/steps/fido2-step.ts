import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherRequest } from "@bitwarden/common/vault/models/request/cipher.request";
import { DialogService } from "@bitwarden/components";
import { UserId } from "@bitwarden/user-core";

import { LogRecorder } from "../log-recorder";

import { logCipherCorruption } from "./corruption-log";
import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

/**
 * Detects Login ciphers whose only decryption failure is corrupt FIDO2 credentials, and repairs
 * them by stripping the FIDO2 part while preserving the rest of the login. Ciphers that fail to
 * decrypt even without their FIDO2 credentials are left for the cipher step.
 */
export class Fido2Step implements RecoveryStep {
  title = "recoveryStepFido2Title";

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

    workingData.fido2CorruptCipherIds = [];

    // Skip anything that is not a user-owned Login cipher with FIDO2 credentials.
    const fido2Ciphers = workingData.ciphers.filter(
      (c) =>
        c.organizationId == null &&
        c.type === CipherType.Login &&
        (c.login?.fido2Credentials?.length ?? 0) > 0,
    );

    for (const cipher of fido2Ciphers) {
      if (await this.decryptSucceeds(cipher, workingData.userId)) {
        continue;
      }

      // The cipher is undecryptable. Try again with the FIDO2 credentials removed to determine
      // whether the corruption is isolated to the FIDO2 part.
      const strippedCipher = this.stripFido2Credentials(cipher);
      if (
        strippedCipher != null &&
        (await this.decryptSucceeds(strippedCipher, workingData.userId))
      ) {
        workingData.fido2CorruptCipherIds.push(cipher.id);
        logCipherCorruption(cipher, logger, "fido2");
      }
    }

    logger.record(
      `Found ${workingData.fido2CorruptCipherIds.length} ciphers with corrupt FIDO2 credentials`,
    );

    return workingData.fido2CorruptCipherIds.length == 0;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    return workingData.fido2CorruptCipherIds.length > 0;
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    if (workingData.fido2CorruptCipherIds.length === 0) {
      logger.record("No ciphers with corrupt FIDO2 credentials to recover");
      return;
    }

    if (!workingData.userId) {
      logger.record("Missing user ID");
      throw new Error("Missing user ID");
    }

    logger.record(
      `Showing confirmation dialog for ${workingData.fido2CorruptCipherIds.length} ciphers`,
    );

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "recoveryDeleteFido2Title" },
      content: { key: "recoveryDeleteFido2Desc" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      logger.record("User cancelled FIDO2 credential deletion");
      throw new Error("FIDO2 recovery cancelled by user");
    }

    logger.record(
      `Removing FIDO2 credentials from ${workingData.fido2CorruptCipherIds.length} ciphers`,
    );

    for (const cipherId of workingData.fido2CorruptCipherIds) {
      const cipher = workingData.ciphers.find((c) => c.id === cipherId);
      if (cipher == null) {
        logger.record(`Cipher ${cipherId} no longer present, skipping`);
        continue;
      }

      const strippedCipher = this.stripFido2Credentials(cipher);
      if (strippedCipher == null) {
        logger.record(`Failed to prepare cipher ${cipherId} for FIDO2 removal`);
        continue;
      }

      try {
        const request = new CipherRequest({
          cipher: strippedCipher,
          encryptedFor: workingData.userId,
        });
        await this.apiService.putCipher(strippedCipher.id, request);
        logger.record(`Removed FIDO2 credentials from cipher ${cipherId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.record(
          `Failed to remove FIDO2 credentials from cipher ${cipherId}: ${errorMessage}`,
        );
        throw error;
      }
    }

    logger.record(
      `Successfully removed FIDO2 credentials from ${workingData.fido2CorruptCipherIds.length} ciphers`,
    );
  }

  /**
   * Returns true when the cipher decrypts without a decryption failure, false on any error or a
   * flagged decryption failure.
   */
  private async decryptSucceeds(cipher: Cipher, userId: UserId): Promise<boolean> {
    try {
      const view = await this.cipherService.decrypt(cipher, userId);
      return !view.decryptionFailure;
    } catch {
      return false;
    }
  }

  /**
   * Deep-clones the encrypted cipher and removes its FIDO2 credentials, leaving the rest of the
   * login intact. Returns undefined if the cipher cannot be cloned.
   */
  private stripFido2Credentials(cipher: Cipher): Cipher | undefined {
    const clone = Cipher.fromJSON(JSON.parse(JSON.stringify(cipher)));
    if (clone?.login == null) {
      return undefined;
    }
    clone.login.fido2Credentials = undefined;
    return clone;
  }
}
