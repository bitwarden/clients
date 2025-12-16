import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { DialogService } from "@bitwarden/components";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

export class CipherStep implements RecoveryStep {
  title = "recoveryStepCipherTitle";

  private undecryptableCipherIds: string[] = [];

  constructor(
    private apiService: ApiService,
    private cipherService: CipherEncryptionService,
    private dialogService: DialogService,
  ) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    if (!workingData.userId) {
      logger.record("Missing user ID");
      return false;
    }

    this.undecryptableCipherIds = [];
    for (const cipher of workingData.ciphers) {
      try {
        await this.cipherService.decrypt(cipher, workingData.userId);
      } catch {
        logger.record(`Cipher ID ${cipher.id} was undecryptable`);
        this.undecryptableCipherIds.push(cipher.id);
      }
    }
    logger.record(`Found ${this.undecryptableCipherIds.length} undecryptable ciphers`);

    return this.undecryptableCipherIds.length == 0;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    return this.undecryptableCipherIds.length > 0;
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    // Recovery means deleting the broken ciphers.
    if (this.undecryptableCipherIds.length === 0) {
      logger.record("No undecryptable ciphers to recover");
      return;
    }

    logger.record(`Showing confirmation dialog for ${this.undecryptableCipherIds.length} ciphers`);

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "recoveryDeleteCiphersTitle" },
      content: { key: "recoveryDeleteCiphersDesc" },
      acceptButtonText: { key: "ok" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      logger.record("User cancelled cipher deletion");
      throw new Error("Cipher recovery cancelled by user");
    }

    logger.record(`Deleting ${this.undecryptableCipherIds.length} ciphers`);

    for (const cipherId of this.undecryptableCipherIds) {
      try {
        await this.apiService.deleteCipher(cipherId);
        logger.record(`Deleted cipher ${cipherId}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.record(`Failed to delete cipher ${cipherId}: ${errorMessage}`);
        throw error;
      }
    }

    logger.record(`Successfully deleted ${this.undecryptableCipherIds.length} ciphers`);
  }
}
