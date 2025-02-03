import { Component } from "@angular/core";

import { PasswordHistoryComponent as BasePasswordHistoryComponent } from "@bitwarden/angular/vault/components/password-history.component";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-password-history",
  templateUrl: "password-history.component.html",
})
export class PasswordHistoryComponent extends BasePasswordHistoryComponent {
  constructor(
    cipherService: CipherService,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    accountService: AccountService,
    toastService: ToastService,
  ) {
    super(cipherService, platformUtilsService, i18nService, accountService, window, toastService);
  }
}
