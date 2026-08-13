import { inject, Injectable } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { firstValueFrom, Subject, switchMap } from "rxjs";
import { filter } from "rxjs/operators";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { DialogService, ToastService } from "@bitwarden/components";

import {
  AttachmentDialogResult,
  AttachmentsV2Component,
} from "../cipher-view/attachments/attachments-v2.component";

import { ArchiveCipherUtilitiesService } from "./archive-cipher-utilities.service";
import { PasswordRepromptService } from "./password-reprompt.service";

/**
 * Handles cipher row actions that can be executed entirely within shared services
 * (no client-specific dialog components or component state required).
 *
 * Actions that open desktop-specific drawers (view, edit, clone, share)
 * remain as events emitted to the host component.
 */
@Injectable({ providedIn: "root" })
export class CipherActionService {
  private readonly accountService = inject(AccountService);
  private readonly archiveCipherUtilitiesService = inject(ArchiveCipherUtilitiesService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly cipherArchiveService = inject(CipherArchiveService);
  private readonly cipherService = inject(CipherService);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);
  private readonly passwordRepromptService = inject(PasswordRepromptService);
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private readonly toastService = inject(ToastService);

  private readonly _cipherModified = new Subject<void>();

  /** Emits after any action completes (success or no-op). Subscribe to trigger a vault refresh. */
  readonly cipherModified$ = this._cipherModified.asObservable();

  private readonly userCanArchive = toSignal(
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.cipherArchiveService.userCanArchive$(userId)),
    ),
    { initialValue: false },
  );

  private readonly userHasPremium = toSignal(
    this.accountService.activeAccount$.pipe(
      filter((account): account is Account => !!account),
      switchMap((account) =>
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      ),
    ),
    { initialValue: false },
  );

  async toggleFavorite(cipher: CipherViewLike): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const fullCipher = await this.cipherService.getFullCipherView(cipher);
    fullCipher.favorite = !fullCipher.favorite;

    await this.cipherService.updateWithServer(fullCipher, userId);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t(
        fullCipher.favorite ? "itemAddedToFavorites" : "itemRemovedFromFavorites",
      ),
    });

    this._cipherModified.next();
  }

  async restore(cipher: CipherViewLike): Promise<void> {
    if (!CipherViewLikeUtils.isDeleted(cipher)) {
      return;
    }

    const toastMessage = CipherViewLikeUtils.isArchived(cipher)
      ? this.i18nService.t("archivedItemRestored")
      : this.i18nService.t("restoredItem");

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));

    try {
      await this.cipherService.restoreWithServer(cipher.id as CipherId, userId);
      this.toastService.showToast({ variant: "success", message: toastMessage });
    } catch (e) {
      this.logService.error(e);
    }

    this._cipherModified.next();
  }

  async archive(cipher: CipherViewLike): Promise<void> {
    if (CipherViewLikeUtils.isDeleted(cipher) || CipherViewLikeUtils.isArchived(cipher)) {
      return;
    }

    if (!this.userCanArchive()) {
      await this.premiumUpgradePromptService.promptForPremium();
      return;
    }

    const fullCipher = await this.cipherService.getFullCipherView(cipher);

    await this.archiveCipherUtilitiesService.archiveCipher(fullCipher);

    this._cipherModified.next();
  }

  async unarchive(cipher: CipherViewLike): Promise<void> {
    if (!CipherViewLikeUtils.isArchived(cipher) || CipherViewLikeUtils.isDeleted(cipher)) {
      return;
    }

    const fullCipher = await this.cipherService.getFullCipherView(cipher);

    await this.archiveCipherUtilitiesService.unarchiveCipher(fullCipher);

    this._cipherModified.next();
  }

  async viewAttachments(cipher: CipherViewLike): Promise<void> {
    if (!this.userHasPremium()) {
      await this.premiumUpgradePromptService.promptForPremium();
      return;
    }

    const dialogRef = AttachmentsV2Component.open(this.dialogService, {
      cipherId: cipher.id as CipherId,
      canEditCipher: cipher.edit,
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (
      result?.action === AttachmentDialogResult.Removed ||
      result?.action === AttachmentDialogResult.Uploaded
    ) {
      this._cipherModified.next();
    }
  }

  async delete(cipher: CipherViewLike): Promise<void> {
    if (!(await this.promptPassword(cipher))) {
      return;
    }

    const isDeleted = CipherViewLikeUtils.isDeleted(cipher);
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "deleteItem" },
      content: { key: isDeleted ? "permanentlyDeleteItemConfirmation" : "deleteItemConfirmation" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    try {
      await (isDeleted
        ? this.cipherService.deleteWithServer(cipher.id as CipherId, userId)
        : this.cipherService.softDeleteWithServer(cipher.id as CipherId, userId));
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t(isDeleted ? "permanentlyDeletedItem" : "deletedItem"),
      });
    } catch (e) {
      this.logService.error(e);
    }
    this._cipherModified.next();
  }

  private async promptPassword(cipher: CipherViewLike): Promise<boolean> {
    return (
      cipher.reprompt === CipherRepromptType.None ||
      (await this.passwordRepromptService.showPasswordPrompt())
    );
  }
}
