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

function label(ref: AttachmentRef): string {
  return `Attachment ${ref.attachment.id} on cipher ${ref.cipher.id} (${ownership(ref.cipher)})`;
}

/** Renaming saves the item, which needs write access. */
function canEdit(cipher: Cipher): boolean {
  return cipher.organizationId == null || cipher.edit;
}

/**
 * Mirrors the server: deleting an attachment needs both write access and delete permission.
 * Upgrading deletes the old attachment too, so it needs the same.
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
 * | broken    | ok, or legacy   | decrypt         | `nameLost`      | rename                     |
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
 *    download, a failed upgrade or a failed rename never leads to deletion.
 * 2. Repairs that keep the user's data (upgrade, rename) run without asking. Deletion always asks.
 * 3. Renaming keeps the attachment and its contents; only its name changes. It saves the whole
 *    item, so with strict decryption off any other field of the item that can't be decrypted is
 *    saved as empty.  
 * 4. Personal items can always be repaired. Organization items need edit access to rename, and
 *    edit access plus delete permission to upgrade or delete, matching the server. Otherwise the
 *    message tells the user to contact support.
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
      const check = await this.checkContents(ref, workingData.userId, logger);
      if (check === ContentCheck.NotChecked) {
        this.unchecked.push(ref);
      } else if (nameOrKeyBroken && check === ContentCheck.Decrypted) {
        logger.record(`${label(ref)} has readable contents and can be renamed`);
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
   * checked. The decrypted contents are discarded.
   */
  private async checkContents(
    ref: AttachmentRef,
    userId: UserId,
    logger: LogRecorder,
  ): Promise<ContentCheck> {
    const url = await this.downloadUrl(ref, userId, logger);
    if (url == null) {
      return ContentCheck.NotChecked;
    }

    let encryptedContent: Uint8Array;
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.status !== 200) {
        logger.record(`${label(ref)} could not be downloaded: HTTP ${response.status}`);
        return ContentCheck.NotChecked;
      }
      encryptedContent = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      logger.record(`${label(ref)} could not be downloaded: ${errorMessage(error)}`);
      return ContentCheck.NotChecked;
    }

    try {
      await this.cipherEncryptionService.decryptAttachmentContent(
        ref.cipher,
        ref.attachment,
        encryptedContent,
        userId,
      );
      return ContentCheck.Decrypted;
    } catch (error) {
      // The service swallows the SDK error, so this is usually a generic "no elements" error.
      const size = Math.max(Number(ref.attachment.size) || 0, encryptedContent.byteLength);
      if (size > MAX_BYTES_TO_JUDGE_UNRECOVERABLE) {
        logger.record(
          `${label(ref)} failed to decrypt but is too large (${size} bytes) to treat as unrecoverable: ${errorMessage(error)}`,
        );
        return ContentCheck.NotChecked;
      }
      logger.record(`${label(ref)} has undecryptable contents: ${errorMessage(error)}`);
      return ContentCheck.Undecryptable;
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

  private renamable(): AttachmentRef[] {
    return this.nameLost.filter((ref) => canEdit(ref.cipher));
  }

  /** Attachments with an issue the user isn't allowed to repair. */
  private notActionable(): AttachmentRef[] {
    return [
      ...this.needsUpgrade.filter((ref) => !canDelete(ref.cipher)),
      ...this.nameLost.filter((ref) => !canEdit(ref.cipher)),
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
      this.upgradable().length > 0 || this.renamable().length > 0 || this.deletable().length > 0
    );
  }

  async runRecovery(workingData: RecoveryWorkingData, logger: LogRecorder): Promise<void> {
    if (!workingData.userId) {
      logger.record("Missing user ID");
      throw new Error("Missing user ID");
    }
    const userId = workingData.userId;

    const failedUpgrades = await this.upgrade(userId, logger);
    const failedRenames = await this.renameNameLost(userId, logger);
    const failedDeletions = await this.deleteUnrecoverable(userId, logger);

    if (failedUpgrades > 0 || failedRenames > 0 || failedDeletions > 0) {
      throw new Error(
        `Attachment recovery failed: ${failedUpgrades} upgrades, ${failedRenames} renames and ${failedDeletions} deletions failed`,
      );
    }
  }

  /**
   * Gives each attachment whose file name was lost a placeholder name, by saving the item with the
   * new name. The SDK encrypts the name and re-wraps the attachment's recovered key; the file
   * itself isn't touched. Like upgrading, this keeps the user's data, so it runs without asking.
   * Returns the number of failures.
   */
  private async renameNameLost(userId: UserId, logger: LogRecorder): Promise<number> {
    const renamable = this.renamable();
    if (renamable.length === 0) {
      return 0;
    }

    logger.record(`Renaming ${renamable.length} attachments with a lost file name`);
    let failed = 0;
    for (const ref of renamable) {
      try {
        // Read and decrypt the item again rather than trusting diagnostics: an earlier repair may
        // already have changed it, and the save has to send its current revision date.
        const current = await this.cipherService.get(ref.cipher.id, userId);
        const currentView = await this.cipherEncryptionService.decrypt(current, userId);
        const attachment = currentView.attachments?.find((a) => a.id === ref.attachment.id);

        if (attachment == null) {
          logger.record(`${label(ref)} was already removed`);
          continue;
        }
        if (!attachment.hasDecryptionError) {
          logger.record(`${label(ref)} was already renamed`);
          continue;
        }

        attachment.fileName = this.i18nService.t("recoveredAttachmentFileName", ref.attachment.id!);
        const renamed = await this.cipherService.updateWithServer(currentView, userId);
        logger.record(`${label(ref)} was renamed`);

        // A legacy attachment couldn't be upgraded while its name was broken: the upgrade
        // decrypts the name first. Now that it has one, upgrade it in the same repair.
        if (attachment.key == null && canDelete(ref.cipher)) {
          await this.cipherService.upgradeOldCipherAttachments(renamed, userId, ref.attachment.id);
          logger.record(`${label(ref)} was upgraded after being renamed`);
        }
      } catch (error) {
        failed++;
        logger.record(`${label(ref)} could not be renamed or upgraded: ${errorMessage(error)}`);
      }
    }
    return failed;
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
