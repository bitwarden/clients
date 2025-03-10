// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, OnInit } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PasswordHistoryView } from "@bitwarden/common/vault/models/view/password-history.view";
import { ToastService } from "@bitwarden/components";

@Directive()
export class PasswordHistoryComponent implements OnInit {
  cipherId: string;
  history: PasswordHistoryView[] = [];

  constructor(
    protected cipherService: CipherService,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected accountService: AccountService,
    private win: Window,
    private toastService: ToastService,
  ) {}

  async ngOnInit() {
    await this.init();
  }

  copy(password: string) {
    const copyOptions = this.win != null ? { window: this.win } : null;
    this.platformUtilsService.copyToClipboard(password, copyOptions);
    this.toastService.showToast({
      variant: "info",
      title: null,
      message: this.i18nService.t("valueCopied", this.i18nService.t("password")),
    });
  }

  protected async init() {
    const activeUserId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const cipher = await this.cipherService.get(this.cipherId, activeUserId);
    const decCipher = await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
    );
    this.history = decCipher.passwordHistory == null ? [] : decCipher.passwordHistory;
  }
}
