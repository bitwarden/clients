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

  /** Archive a cipher, with confirmation dialog and password reprompt checks.
   *
   * @param cipher The cipher to archive
   * @param skipReprompt Whether to skip the password reprompt check
   * @returns The archived CipherData on success, or false on failure or cancellation
   */
  async archiveCipher(cipher: CipherView, skipReprompt = false) {
    if (!skipReprompt) {
      const repromptPassed = await this.passwordRepromptService.passwordRepromptCheck(cipher);
      if (!repromptPassed) {
        return false;
      }
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "archiveItem" },
      content: { key: "archiveItemConfirmDesc" },
      type: "info",
    });

    if (!confirmed) {
      return false;
    }

    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    try {
      const cipherResponse = await this.cipherArchiveService.archiveWithServer(
        cipher.id as CipherId,
        userId,
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("itemWasSentToArchive"),
      });
      return cipherResponse;
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return false;
    }
  }

  /** Unarchives a cipher
   * @param cipher The cipher to unarchive
   * @returns The unarchived cipher on success, or false on failure
   */
  async unarchiveCipher(cipher: CipherView) {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    try {
      const cipherResponse = await this.cipherArchiveService.unarchiveWithServer(
        cipher.id as CipherId,
        userId,
      );
      this.toastService.showToast({
        variant: "success",
        message: this.i18nService.t("itemWasUnarchived"),
      });
      return cipherResponse;
    } catch {
      this.toastService.showToast({
        variant: "error",
        message: this.i18nService.t("errorOccurred"),
      });
      return false;
    }
  }
}
