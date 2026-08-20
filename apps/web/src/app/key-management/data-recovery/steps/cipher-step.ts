import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { DialogService } from "@bitwarden/components";
// eslint-disable-next-line no-restricted-imports
import { EncryptionType, EncryptService, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

/** Prefix of an AesCbc256_HmacSha256_B64 encrypted string. */
const AES_CBC_256_HMAC_SHA_256_PREFIX = "2.";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class CipherStep implements RecoveryStep {
  title = "recoveryStepCipherTitle";

  private undecryptableCipherIds: string[] = [];
  private decryptableCipherIds: string[] = [];

  constructor(
    private apiService: ApiService,
    private cipherService: CipherEncryptionService,
    private dialogService: DialogService,
    private encryptService: EncryptService,
  ) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    if (!workingData.userId) {
      logger.record("Missing user ID");
      return false;
    }

    this.undecryptableCipherIds = [];
    this.decryptableCipherIds = [];
    // The tool is currently only implemented to handle ciphers that are corrupt for a user. For an organization, the case of
    // local user not having access to the organization key is not properly handled here, and should be implemented separately.
    // For now, this just filters out and does not consider corrupt organization ciphers.
    const userCiphers = workingData.ciphers.filter((c) => c.organizationId == null);
    for (const cipher of userCiphers) {
      const failures: string[] = [];

      try {
        await this.cipherService.decrypt(cipher, workingData.userId);
      } catch (error) {
        failures.push(`full decryption failed: ${errorMessage(error)}`);
      }

      // A cipher can survive a full decryption attempt while an individual field is corrupt, so
      // probe the name ciphertext directly.
      const nameFailure = await this.checkNameDecrypts(cipher, workingData.userKey);
      if (nameFailure != null) {
        failures.push(nameFailure);
      }

      if (failures.length === 0) {
        this.decryptableCipherIds.push(cipher.id);
        continue;
      }

      const cipherKeyState = cipher.key != null ? "present" : "absent";
      const itemType = cipher.type != null ? cipher.type : "unknown";
      const fido2CredentialsPresent = cipher.login?.fido2Credentials != null ? "present" : "absent";
      logger.record(
        `Cipher ID ${cipher.id} was undecryptable (cipher key ${cipherKeyState}, item type ${itemType}, FIDO2 credentials ${fido2CredentialsPresent}): ${failures.join("; ")}`,
      );
      this.undecryptableCipherIds.push(cipher.id);
    }
    logger.record(`Found ${this.undecryptableCipherIds.length} undecryptable ciphers`);
    logger.record(`Found ${this.decryptableCipherIds.length} decryptable ciphers`);

    return this.undecryptableCipherIds.length == 0;
  }

  /**
   * Probes the cipher's name field for field-level corruption. Returns a failure reason, or null
   * when the name decrypts or is not a form we probe.
   *
   * Null means that the check did not fail. A string value means the check failed.
   */
  private async checkNameDecrypts(cipher: Cipher, userKey: UserKey | null): Promise<string | null> {
    const encryptedName = cipher.name?.encryptedString;
    if (
      userKey == null ||
      userKey.inner().type !== EncryptionType.AesCbc256_HmacSha256_B64 ||
      encryptedName == null ||
      !encryptedName.startsWith(AES_CBC_256_HMAC_SHA_256_PREFIX)
    ) {
      return null;
    }

    // Fields are encrypted with the cipher key when one is present, otherwise with the user key.
    let vaultItemDecryptionKey: SymmetricCryptoKey = userKey;
    if (cipher.key != null) {
      try {
        vaultItemDecryptionKey = await this.encryptService.unwrapSymmetricKey(cipher.key, userKey);
      } catch (error) {
        return `cipher key could not be unwrapped: ${errorMessage(error)}`;
      }
    }

    try {
      await this.encryptService.decryptString(cipher.name!, vaultItemDecryptionKey);
      return null;
    } catch (error) {
      return `name field could not be decrypted: ${errorMessage(error)}`;
    }
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    // If everything fails to decrypt, it's a deeper issue and we shouldn't offer recovery here.
    return this.undecryptableCipherIds.length > 0 && this.decryptableCipherIds.length > 0;
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
        logger.record(`Failed to delete cipher ${cipherId}: ${errorMessage(error)}`);
        throw error;
      }
    }

    logger.record(`Successfully deleted ${this.undecryptableCipherIds.length} ciphers`);
  }
}
