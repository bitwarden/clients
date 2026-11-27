import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherEncryptionService } from "@bitwarden/common/vault/abstractions/cipher-encryption.service";
import { CipherSdkService } from "@bitwarden/common/vault/abstractions/cipher-sdk.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { AttachmentView } from "@bitwarden/common/vault/models/view/attachment.view";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService } from "@bitwarden/components";
import { isCipherGetAttachmentDownloadUrlError } from "@bitwarden/sdk-internal";

import { LogRecorder } from "../log-recorder";

import { RecoveryStep, RecoveryWorkingData } from "./recovery-step";
import { errorMessage, ownership } from "./step-utils";

/** An attachment together with the vault item that holds it. */
type AttachmentRef = {
  /** The encrypted item, which carries the ownership and permission details. */
  cipher: Cipher;
  /** The decrypted item, which the attachment upgrade needs. */
  view: CipherView;
  attachment: AttachmentView;
};

/** Result of downloading and decrypting an attachment's file contents: the table's "Contents". */
const ContentCheck = Object.freeze({
  Decrypted: "decrypted",
  Undecryptable: "undecryptable",
  NotChecked: "notChecked",
} as const);
type ContentCheck = (typeof ContentCheck)[keyof typeof ContentCheck];

/**
 * Above this size a failed decryption isn't trusted to mean broken contents. The decryption
 * service hides the SDK's error, so running out of memory on a large file looks the same as a
 * failed decryption, and that must not lead to deleting the file.
 */
const MAX_BYTES_TO_JUDGE_UNRECOVERABLE = 100 * 1024 * 1024;

type ContentResult =
  | { check: typeof ContentCheck.Decrypted; data: Uint8Array }
  | { check: typeof ContentCheck.Undecryptable | typeof ContentCheck.NotChecked };

function label(ref: AttachmentRef): string {
  return `Attachment ${ref.attachment.id} on cipher ${ref.cipher.id} (${ownership(ref.cipher)})`;
}

/**
 * Mirrors the server: deleting an attachment needs both write access and delete permission. Every
 * repair here deletes an attachment (upgrading and re-saving remove the old one), so all need it.
 */
function canDelete(cipher: Cipher): boolean {
  return cipher.organizationId == null || (cipher.edit && cipher.permissions?.delete === true);
}

/**
 * Checks the attachments of every item in `decryptedCiphers` and repairs what it can. See the
 * data-recovery README for how this step relates to the cipher step and the vault.
 *
 * Contents are encrypted with the attachment key, or with the item key for legacy attachments, so
 * a broken attachment key always means unreadable contents. The first matching row applies:
 *
 * | File name | Attachment key  | Contents        | Group           | Repair                     |
 * |-----------|-----------------|-----------------|-----------------|----------------------------|
 * | any       | any             | not checked     | `unchecked`     | none, reported only        |
 * | broken    | ok, or legacy   | decrypt         | `nameLost`      | re-save, placeholder name  |
 * | any       | broken          | can't decrypt   | `unrecoverable` | delete, after confirmation |
 * | any       | ok, or legacy   | don't decrypt   | `unrecoverable` | delete, after confirmation |
 * | ok        | legacy          | decrypt         | `needsUpgrade`  | upgrade to attachment key  |
 * | ok        | ok              | decrypt         | (healthy)       | none                       |
 *
 * "Not checked" means the file couldn't be downloaded, or it is too large for a failed
 * decryption to be trusted (see `MAX_BYTES_TO_JUDGE_UNRECOVERABLE`).
 *
 * Safety rules:
 * 1. An attachment is deleted only if its contents were downloaded and failed to decrypt. A failed
 *    download, a failed upgrade or a failed re-save never leads to deletion.
 * 2. Repairs that keep the user's data (upgrade, re-save) run without asking. Deletion always asks.
 * 3. A re-save removes the broken attachment only after a readable copy exists. Re-saving is safe
 *    to repeat: if an earlier repair already saved a copy that decrypts, only the removal is
 *    retried.
 * 4. Personal items can always be repaired. Organization items need edit access and delete
 *    permission for any repair, matching the server, because every repair deletes an attachment.
 *    Otherwise the message tells the user to contact support.
 */
export class AttachmentStep implements RecoveryStep {
  title = "recoveryStepAttachmentTitle";
  message?: string;

  private unchecked: AttachmentRef[] = [];
  private nameLost: AttachmentRef[] = [];
  private unrecoverable: AttachmentRef[] = [];
  private needsUpgrade: AttachmentRef[] = [];

  constructor(
    private cipherService: CipherService,
    private cipherSdkService: CipherSdkService,
    private cipherEncryptionService: CipherEncryptionService,
    private dialogService: DialogService,
    private i18nService: I18nService,
  ) {}

  async runDiagnostics(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<boolean> {
    this.unchecked = [];
    this.nameLost = [];
    this.unrecoverable = [];
    this.needsUpgrade = [];
    this.message = undefined;

    if (!workingData.userId) {
      logger.record("Missing user ID");
      return false;
    }

    if (workingData.decryptedCiphers == null) {
      logger.record("Vault items were not decrypted, so attachments could not be checked");
      this.message = this.i18nService.t("recoveryAttachmentsNotChecked");
      return false;
    }

    const encryptedById = new Map(workingData.ciphers.map((c) => [c.id, c]));
    const refs: AttachmentRef[] = [];
    for (const view of workingData.decryptedCiphers) {
      const cipher = encryptedById.get(view.id);
      if (cipher == null) {
        continue;
      }
      for (const attachment of view.attachments ?? []) {
        refs.push({ cipher, view, attachment });
      }
    }
    logger.record(`Checking ${refs.length} attachments`);

    // One at a time, so only one decrypted file is held in memory.
    for (const ref of refs) {
      // The SDK flags a broken file name and a broken attachment key the same way, and with a
      // broken key the view has no key, like a legacy attachment. The content check below settles
      // it: decryption fails whenever the key is broken.
      const nameOrKeyBroken = ref.attachment.hasDecryptionError;
      if (nameOrKeyBroken) {
        logger.record(`${label(ref)} has an undecryptable file name or key`);
      }

      // Follows the table in the class comment, row by row. If only the file name is broken, the
      // contents still decrypt.
      const { check } = await this.downloadAndDecrypt(ref, ref.cipher, workingData.userId, logger);
      if (check === ContentCheck.NotChecked) {
        this.unchecked.push(ref);
      } else if (nameOrKeyBroken && check === ContentCheck.Decrypted) {
        logger.record(`${label(ref)} has readable contents and can be saved again`);
        this.nameLost.push(ref);
      } else if (check === ContentCheck.Undecryptable) {
        this.unrecoverable.push(ref);
      } else if (ref.attachment.key == null) {
        logger.record(`${label(ref)} uses old encryption`);
        this.needsUpgrade.push(ref);
      }
    }

    this.logSummary(logger);
    this.updateMessage();

    return (
      this.nameLost.length === 0 &&
      this.unrecoverable.length === 0 &&
      this.needsUpgrade.length === 0
    );
  }

  /**
   * Downloads the attachment the same way the vault does and decrypts it. Only a failed decryption
   * of a file small enough to judge counts as undecryptable; anything else means it couldn't be
   * checked.
   *
   * @param currentCipher The item as it is stored now. Diagnostics pass the synced item; repairs
   * pass the item read again, since earlier repairs may have changed it.
   */
  private async downloadAndDecrypt(
    ref: AttachmentRef,
    currentCipher: Cipher,
    userId: UserId,
    logger: LogRecorder,
  ): Promise<ContentResult> {
    const url = await this.downloadUrl(ref, userId, logger);
    if (url == null) {
      return { check: ContentCheck.NotChecked };
    }

    let encryptedContent: Uint8Array;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status !== 200) {
        logger.record(`${label(ref)} could not be downloaded: HTTP ${response.status}`);
        return { check: ContentCheck.NotChecked };
      }
      encryptedContent = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      logger.record(`${label(ref)} could not be downloaded: ${errorMessage(error)}`);
      return { check: ContentCheck.NotChecked };
    }

    try {
      const data = await this.cipherEncryptionService.decryptAttachmentContent(
        currentCipher,
        ref.attachment,
        encryptedContent,
        userId,
      );
      return { check: ContentCheck.Decrypted, data };
    } catch (error) {
      // The service swallows the SDK error, so this is usually a generic "no elements" error.
      const size = Math.max(Number(ref.attachment.size) || 0, encryptedContent.byteLength);
      if (size > MAX_BYTES_TO_JUDGE_UNRECOVERABLE) {
        logger.record(
          `${label(ref)} failed to decrypt but is too large (${size} bytes) to treat as unrecoverable: ${errorMessage(error)}`,
        );
        return { check: ContentCheck.NotChecked };
      }
      logger.record(`${label(ref)} has undecryptable contents: ${errorMessage(error)}`);
      return { check: ContentCheck.Undecryptable };
    }
  }

  private async downloadUrl(
    ref: AttachmentRef,
    userId: UserId,
    logger: LogRecorder,
  ): Promise<string | undefined> {
    if (ref.attachment.id == null) {
      logger.record(`Attachment without an ID on cipher ${ref.cipher.id} could not be checked`);
      return undefined;
    }

    try {
      return await this.cipherSdkService.getAttachmentDownloadUrl(
        ref.cipher.id as CipherId,
        ref.attachment.id,
        userId,
      );
    } catch (error) {
      // Older attachments have no download endpoint; the vault falls back to the stored URL.
      if (isCipherGetAttachmentDownloadUrlError(error) && error.variant === "NotFound") {
        return ref.attachment.url;
      }
      logger.record(`${label(ref)} download URL could not be fetched: ${errorMessage(error)}`);
      return undefined;
    }
  }

  private upgradable(): AttachmentRef[] {
    return this.needsUpgrade.filter((ref) => canDelete(ref.cipher));
  }

  private deletable(): AttachmentRef[] {
    return this.unrecoverable.filter((ref) => ref.attachment.id != null && canDelete(ref.cipher));
  }

  private notDeletable(): AttachmentRef[] {
    const deletable = this.deletable();
    return this.unrecoverable.filter((ref) => !deletable.includes(ref));
  }

  /** Re-saving adds a new attachment and removes the broken one, so it needs delete permission. */
  private resavable(): AttachmentRef[] {
    return this.nameLost.filter((ref) => canDelete(ref.cipher));
  }

  /** Attachments with an issue the user isn't allowed to repair. */
  private notActionable(): AttachmentRef[] {
    return [
      ...this.needsUpgrade.filter((ref) => !canDelete(ref.cipher)),
      ...this.nameLost.filter((ref) => !canDelete(ref.cipher)),
      ...this.notDeletable(),
    ];
  }

  private logSummary(logger: LogRecorder) {
    const count = (refs: AttachmentRef[]) => {
      const organization = refs.filter((ref) => ref.cipher.organizationId != null).length;
      return `${refs.length} (${refs.length - organization} personal, ${organization} organization)`;
    };
    logger.record(`Attachments that could not be checked: ${count(this.unchecked)}`);
    logger.record(`Attachments with a lost file name: ${count(this.nameLost)}`);
    logger.record(`Attachments that are unrecoverable: ${count(this.unrecoverable)}`);
    logger.record(`Attachments that need an upgrade: ${count(this.needsUpgrade)}`);
    logger.record(
      `Attachments that can't be repaired without permission: ${count(this.notActionable())}`,
    );
  }

  private updateMessage() {
    const notActionable = this.notActionable();
    const parts: string[] = [];
    if (this.needsUpgrade.length > 0) {
      parts.push(this.i18nService.t("recoveryAttachmentsOldEncryption", this.needsUpgrade.length));
    }
    if (this.nameLost.length > 0) {
      parts.push(this.i18nService.t("recoveryAttachmentsNameLost", this.nameLost.length));
    }
    if (this.unrecoverable.length > 0) {
      parts.push(this.i18nService.t("recoveryAttachmentsUnrecoverable", this.unrecoverable.length));
    }
    if (this.unchecked.length > 0) {
      parts.push(this.i18nService.t("recoveryAttachmentsUnchecked", this.unchecked.length));
    }
    if (notActionable.length > 0) {
      parts.push(this.i18nService.t("recoveryOrgAttachmentsContactSupport", notActionable.length));
    }

    this.message = parts.length > 0 ? parts.join(" ") : undefined;
  }

  canRecover(workingData: RecoveryWorkingData): boolean {
    return (
      this.upgradable().length > 0 || this.resavable().length > 0 || this.deletable().length > 0
    );
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    if (!workingData.userId) {
      logger.record("Missing user ID");
      throw new Error("Missing user ID");
    }
    const userId = workingData.userId;

    const failedUpgrades = await this.upgrade(userId, logger);
    const failedResaves = await this.resaveNameLost(userId, logger);
    const failedDeletions = await this.deleteUnrecoverable(userId, logger);

    if (failedUpgrades > 0 || failedResaves > 0 || failedDeletions > 0) {
      throw new Error(
        `Attachment recovery failed: ${failedUpgrades} upgrades, ${failedResaves} re-saves and ${failedDeletions} deletions failed`,
      );
    }
  }

  /**
   * Saves each attachment whose file name was lost again under a placeholder name, then removes
   * the broken one. Nothing is removed unless the new copy was saved. Like upgrading, this keeps
   * the user's data, so it runs without asking. Returns the number of failures.
   */
  private async resaveNameLost(userId: UserId, logger: LogRecorder): Promise<number> {
    const resavable = this.resavable();
    if (resavable.length === 0) {
      return 0;
    }

    logger.record(`Saving ${resavable.length} attachments with a lost file name again`);
    let failed = 0;
    for (const ref of resavable) {
      const fileName = this.i18nService.t("recoveredAttachmentFileName", ref.attachment.id!);
      try {
        // Read and decrypt the item again rather than trusting diagnostics: an earlier repair may
        // already have saved the copy or removed the original, and the upload has to send the
        // item's current revision date.
        const current = await this.cipherService.get(ref.cipher.id, userId);
        const currentView = await this.cipherEncryptionService.decrypt(current, userId);
        const currentAttachments = currentView.attachments ?? [];
        const originalPresent = currentAttachments.some((a) => a.id === ref.attachment.id);

        if (!originalPresent) {
          logger.record(`${label(ref)} was already removed`);
          continue;
        }

        if (await this.hasReadableCopy(ref, current, currentView, userId, logger)) {
          // A previous repair saved the copy but failed to remove the original. Uploading again
          // would add a duplicate, so only the removal is retried.
          logger.record(`${label(ref)} was already saved again by an earlier repair`);
        } else {
          const result = await this.downloadAndDecrypt(ref, current, userId, logger);
          if (result.check !== ContentCheck.Decrypted) {
            throw new Error("contents could no longer be read");
          }
          await this.cipherService.saveAttachmentRawWithServer(
            current,
            fileName,
            result.data,
            userId,
          );
          logger.record(`${label(ref)} was saved again as a new attachment`);
        }
      } catch (error) {
        failed++;
        logger.record(`${label(ref)} could not be saved again: ${errorMessage(error)}`);
        continue;
      }

      try {
        await this.cipherService.deleteAttachmentWithServer(
          ref.cipher.id,
          ref.attachment.id!,
          userId,
          false,
        );
        logger.record(`${label(ref)} was removed after being saved again`);
      } catch (error) {
        failed++;
        logger.record(
          `${label(ref)} was saved again but could not be removed: ${errorMessage(error)}`,
        );
      }
    }
    return failed;
  }

  /**
   * Whether an earlier repair already saved a readable copy of `ref`. Copies are found by the
   * original attachment's ID in their name, which doesn't depend on the language the placeholder
   * name was written in. A copy only counts if it downloads and decrypts: an earlier upload may
   * have failed after the attachment was created, leaving an entry without a usable file.
   */
  private async hasReadableCopy(
    ref: AttachmentRef,
    current: Cipher,
    currentView: CipherView,
    userId: UserId,
    logger: LogRecorder,
  ): Promise<boolean> {
    const copies = (currentView.attachments ?? []).filter(
      (a) =>
        a.id !== ref.attachment.id &&
        !a.hasDecryptionError &&
        a.fileName?.includes(ref.attachment.id!) === true,
    );
    for (const copy of copies) {
      const copyRef: AttachmentRef = { cipher: current, view: currentView, attachment: copy };
      const { check } = await this.downloadAndDecrypt(copyRef, current, userId, logger);
      if (check === ContentCheck.Decrypted) {
        return true;
      }
      logger.record(`${label(copyRef)} looks like an earlier copy but can't be read`);
    }
    return false;
  }

  /**
   * Upgrading is not destructive, so it runs without asking. A failed upgrade is never followed by
   * a deletion: the contents decrypted during diagnostics, so the file is healthy and the failure
   * is most likely a download or upload problem. Returns the number of failures.
   */
  private async upgrade(userId: UserId, logger: LogRecorder): Promise<number> {
    const upgradable = this.upgradable();
    if (upgradable.length === 0) {
      return 0;
    }

    logger.record(`Upgrading ${upgradable.length} attachments with old encryption`);
    let failed = 0;
    for (const ref of upgradable) {
      try {
        // The view is from diagnostics; the SDK reads the item's current state itself.
        await this.cipherService.upgradeOldCipherAttachments(ref.view, userId, ref.attachment.id);
        logger.record(`${label(ref)} was upgraded`);
      } catch (error) {
        failed++;
        logger.record(`${label(ref)} could not be upgraded: ${errorMessage(error)}`);
      }
    }
    return failed;
  }

  /** Asks before deleting unrecoverable attachments. Returns the number of failed deletions. */
  private async deleteUnrecoverable(userId: UserId, logger: LogRecorder): Promise<number> {
    const deletable = this.deletable();
    if (deletable.length === 0) {
      return 0;
    }

    const notDeletableCount = this.notDeletable().length;
    logger.record(
      `Showing confirmation dialog for ${deletable.length} attachments; ${notDeletableCount} unrecoverable attachments can't be deleted`,
    );

    const content =
      notDeletableCount > 0
        ? {
            key: "recoveryDeleteAttachmentsWithUndeletableDesc",
            placeholders: [deletable.length, notDeletableCount],
          }
        : { key: "recoveryDeleteAttachmentsCountDesc", placeholders: [deletable.length] };

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "recoveryDeleteAttachmentsTitle" },
      content,
      acceptButtonText: { key: "ok" },
      cancelButtonText: { key: "cancel" },
      type: "danger",
    });

    if (!confirmed) {
      logger.record("User cancelled attachment deletion");
      throw new Error("Attachment recovery cancelled by user");
    }

    let failed = 0;
    for (const ref of deletable) {
      try {
        await this.cipherService.deleteAttachmentWithServer(
          ref.cipher.id,
          ref.attachment.id!,
          userId,
          false,
        );
        logger.record(`${label(ref)} was deleted`);
      } catch (error) {
        failed++;
        logger.record(`${label(ref)} could not be deleted: ${errorMessage(error)}`);
      }
    }
    return failed;
  }
}
