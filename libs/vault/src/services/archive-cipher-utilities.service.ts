import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherArchiveService } from "@bitwarden/common/vault/abstractions/cipher-archive.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { DialogService, ToastService } from "@bitwarden/components";

import { PasswordRepromptService } from "./password-reprompt.service";

/**
 * Wrapper around {@link CipherArchiveService} to provide UI enhancements for archiving/unarchiving ciphers.
 */
@Injectable({ providedIn: "root" })
export class ArchiveCipherUtilitiesService {
  constructor(
    private cipherArchiveService: CipherArchiveService,
    private dialogService: DialogService,
    private passwordRepromptService: PasswordRepromptService,
    private toastService: ToastService,
    private i18nService: I18nService,
    private accountService: AccountService,
  ) {}

  /** Archive a cipher, with confirmation dialog and password reprompt checks. */
  async archiveCipher(cipher: CipherView) {
    const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
    if (!repromptPassed) {
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "archiveItem" },
      content: { key: "archiveItemConfirmDesc" },
      type: "info",
    });

    if (!confirmed) {
      return;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherArchiveService
      .archiveWithServer(cipher.id as CipherId, userId)
      .then(() => {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("itemWasSentToArchive"),
        });
      })
      .catch(() => {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("errorOccurred"),
        });
      });
  }

  /** Unarchives a cipher  */
  async unarchiveCipher(cipher: CipherView) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await this.cipherArchiveService
      .unarchiveWithServer(cipher.id as CipherId, userId)
      .then(() => {
        this.toastService.showToast({
          variant: "success",
          message: this.i18nService.t("itemWasUnarchived"),
        });
      })
      .catch(() => {
        this.toastService.showToast({
          variant: "error",
          message: this.i18nService.t("errorOccurred"),
        });
      });
  }
}
