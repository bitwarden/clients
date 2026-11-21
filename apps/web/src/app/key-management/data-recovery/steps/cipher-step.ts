import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { DialogService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function ownership(cipher: Cipher): string {
  return cipher.organizationId == null ? "personal" : `organization ${cipher.organizationId}`;
}

/**
 * Identifies the key a cipher's data is encrypted under: the user key for personal items, or the
 * organization's key for organization items.
 */
function keyScope(cipher: Cipher): string {
  return cipher.organizationId ?? "personal";
}

/** Counts per ownership bucket, used for the summary lines in the diagnostic log. */
type OwnershipCounts = { personal: number; organization: number };

function countByOwnership(ciphers: Cipher[]): OwnershipCounts {
  const organization = ciphers.filter((c) => c.organizationId != null).length;
  return { personal: ciphers.length - organization, organization };
}

export class CipherStep implements RecoveryStep {
  title = "recoveryStepCipherTitle";
  message?: string;

  private undecryptableCiphers: Cipher[] = [];
  private decryptableCiphers: Cipher[] = [];
  /** Undecryptable ciphers that are safe to offer for deletion. */
  private deletableCiphers: Cipher[] = [];

  constructor(
    private apiService: ApiService,
    private cipherService: CipherEncryptionService,
    private dialogService: DialogService,
    private keyService: KeyService,
    private i18nService: I18nService,
  ) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    this.undecryptableCiphers = [];
    this.decryptableCiphers = [];
    this.deletableCiphers = [];
    this.message = undefined;

    if (!workingData.userId) {
      logger.record("Missing user ID");
      return false;
    }

    const { checkable, skipped } = await this.partitionByOrgKeyAvailability(
      workingData.ciphers,
      workingData.userId,
    );
    for (const cipher of skipped) {
      logger.record(
        `Cipher ID ${cipher.id} (${ownership(cipher)}) was skipped: no key is available for the organization`,
      );
    }

    // Decrypt through the same service and method the vault uses for full decryption, so this
    // step flags exactly the items the vault shows as decryption failures.
    const failures = await this.decryptAndCollectFailures(checkable, workingData, logger);
    const failedIds = new Set(failures.map((c) => c.id));
    this.decryptableCiphers = checkable.filter((c) => !failedIds.has(c.id));
    const scopesWithDecryptableItems = new Set(this.decryptableCiphers.map(keyScope));

    for (const cipher of failures) {
      const cipherKeyState = cipher.key != null ? "present" : "absent";
      const itemType = cipher.type != null ? cipher.type : "unknown";
      const fido2CredentialsPresent = cipher.login?.fido2Credentials != null ? "present" : "absent";
      logger.record(
        `Cipher ID ${cipher.id} (${ownership(cipher)}) was undecryptable (cipher key ${cipherKeyState}, item type ${itemType}, FIDO2 credentials ${fido2CredentialsPresent})`,
      );
      this.undecryptableCiphers.push(cipher);

      const reasons = this.reasonsNotDeletable(cipher, scopesWithDecryptableItems);
      if (reasons.length === 0) {
        this.deletableCiphers.push(cipher);
      } else {
        logger.record(
          `Cipher ID ${cipher.id} (${ownership(cipher)}) cannot be deleted: ${reasons.join("; ")}`,
        );
      }
    }

    this.logSummary(logger, skipped);

    const notDeletableOrgCount = this.notDeletableOrgCiphers().length;
    if (notDeletableOrgCount > 0) {
      this.message = this.i18nService.t("recoveryOrgItemsContactSupport", notDeletableOrgCount);
    }

    return this.undecryptableCiphers.length === 0;
  }

  /**
   * Returns why an undecryptable cipher must not be offered for deletion, or an empty list when it
   * is safe to delete.
   *
   * Deletion is only safe when at least one other item encrypted under the same key decrypts. When
   * every item under a key fails, the key itself (or this device's copy of it) is the likely
   * problem rather than the items, and deleting would destroy data that is intact for everyone
   * else, including other organization members.
   */
  private reasonsNotDeletable(cipher: Cipher, scopesWithDecryptableItems: Set<string>): string[] {
    const reasons: string[] = [];
    if (!scopesWithDecryptableItems.has(keyScope(cipher))) {
      reasons.push("no other item encrypted with the same key decrypts");
    }
    if (cipher.organizationId != null && cipher.permissions?.delete !== true) {
      reasons.push("the user lacks delete permission");
    }
    return reasons;
  }

  private notDeletableOrgCiphers(): Cipher[] {
    return this.undecryptableCiphers.filter(
      (c) => c.organizationId != null && !this.deletableCiphers.includes(c),
    );
  }

  /**
   * Mirrors the vault's `excludeCiphersMissingOrgKey` (`DefaultCipherService`): organization
   * ciphers whose organization key is not available are not decrypted at all, so they are neither
   * healthy nor corrupt. When no organization keys are loaded, nothing is excluded.
   */
  private async partitionByOrgKeyAvailability(
    ciphers: Cipher[],
    userId: NonNullable<RecoveryWorkingData["userId"]>,
  ): Promise<{ checkable: Cipher[]; skipped: Cipher[] }> {
    const orgKeys = (await firstValueFrom(this.keyService.cipherDecryptionKeys$(userId)))?.orgKeys;
    if (orgKeys == null) {
      return { checkable: ciphers, skipped: [] };
    }

    const checkable: Cipher[] = [];
    const skipped: Cipher[] = [];
    for (const cipher of ciphers) {
      if (
        cipher.organizationId == null ||
        orgKeys[cipher.organizationId as OrganizationId] != null
      ) {
        checkable.push(cipher);
      } else {
        skipped.push(cipher);
      }
    }
    return { checkable, skipped };
  }

  /**
   * Returns the encrypted ciphers that failed to decrypt. `decryptManyLegacy` reports failures as
   * placeholder views, so they are mapped back to the encrypted ciphers by ID to keep the key,
   * type and permission details this step needs.
   */
  private async decryptAndCollectFailures(
    ciphers: Cipher[],
    workingData: RecoveryWorkingData,
    logger: LogRecorder,
  ): Promise<Cipher[]> {
    if (ciphers.length === 0) {
      return [];
    }

    try {
      const [, failedViews] = await this.cipherService.decryptManyLegacy(
        ciphers,
        workingData.userId!,
      );
      const failedIds = new Set(failedViews.map((view) => view.id));
      return ciphers.filter((c) => failedIds.has(c.id));
    } catch (error) {
      // The whole batch failed (e.g. no SDK client for the user), so no per-item result exists.
      logger.record(`Vault item decryption could not run: ${errorMessage(error)}`);
      throw new Error(`Vault item decryption could not run: ${errorMessage(error)}`);
    }
  }

  private logSummary(logger: LogRecorder, skipped: Cipher[]) {
    const corrupt = countByOwnership(this.undecryptableCiphers);
    const healthy = countByOwnership(this.decryptableCiphers);
    const skippedCounts = countByOwnership(skipped);

    logger.record(
      `Personal items: ${corrupt.personal} undecryptable, ${healthy.personal} decryptable`,
    );
    logger.record(
      `Organization items: ${corrupt.organization} undecryptable, ${healthy.organization} decryptable, ${skippedCounts.organization} skipped (organization key unavailable)`,
    );
    logger.record(`Found ${this.undecryptableCiphers.length} undecryptable ciphers`);
    logger.record(`Found ${this.decryptableCiphers.length} decryptable ciphers`);
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    // Deletable ciphers already exclude any key whose items all fail to decrypt.
    return this.deletableCiphers.length > 0;
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    // Recovery means deleting the broken ciphers the user is allowed to delete.
    if (this.deletableCiphers.length === 0) {
      logger.record("No undecryptable ciphers to recover");
      return;
    }

    const counts = countByOwnership(this.deletableCiphers);
    const notDeletableCount = this.undecryptableCiphers.length - this.deletableCiphers.length;
    const notDeletableOrgCount = this.notDeletableOrgCiphers().length;
    logger.record(
      `Showing confirmation dialog for ${this.deletableCiphers.length} ciphers (${counts.personal} personal, ${counts.organization} organization); ${notDeletableCount} undecryptable ciphers will be left unchanged`,
    );

    // The counts describe what will be deleted. Undecryptable organization items that can't be
    // deleted are called out separately so the dialog doesn't under-report what diagnostics found.
    const content =
      notDeletableOrgCount > 0
        ? {
            key: "recoveryDeleteCiphersWithUndeletableDesc",
            placeholders: [this.deletableCiphers.length, notDeletableOrgCount],
          }
        : {
            key: "recoveryDeleteCiphersCountDesc",
            placeholders: [this.deletableCiphers.length],
          };

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "recoveryDeleteCiphersTitle" },
      content,
      acceptButtonText: { key: "ok" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      logger.record("User cancelled cipher deletion");
      throw new Error("Cipher recovery cancelled by user");
    }

    logger.record(`Deleting ${this.deletableCiphers.length} ciphers`);

    // Attempt every deletion so one failure doesn't leave the rest behind.
    let failedCount = 0;
    for (const cipher of this.deletableCiphers) {
      try {
        await this.apiService.deleteCipher(cipher.id);
        logger.record(`Deleted cipher ${cipher.id} (${ownership(cipher)})`);
      } catch (error) {
        failedCount++;
        logger.record(
          `Failed to delete cipher ${cipher.id} (${ownership(cipher)}): ${errorMessage(error)}`,
        );
      }
    }

    if (failedCount > 0) {
      throw new Error(`Failed to delete ${failedCount} of ${this.deletableCiphers.length} ciphers`);
    }

    logger.record(`Successfully deleted ${this.deletableCiphers.length} ciphers`);
  }
}
