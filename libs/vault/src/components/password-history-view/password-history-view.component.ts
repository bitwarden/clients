// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { OnInit, Component, Input } from "@angular/core";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherId, UserId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { PasswordHistoryView } from "@bitwarden/common/vault/models/view/password-history.view";
import { ItemModule, ColorPasswordModule, IconButtonModule } from "@bitwarden/components";

@Component({
  selector: "vault-password-history-view",
  templateUrl: "./password-history-view.component.html",
  standalone: true,
  imports: [CommonModule, ItemModule, ColorPasswordModule, IconButtonModule, JslibModule],
})
export class PasswordHistoryViewComponent implements OnInit {
  /**
   * The ID of the cipher to display the password history for.
   */
  @Input({ required: true }) cipherId: CipherId;

  /** The password history for the cipher. */
  history: PasswordHistoryView[] = [];

  constructor(
    protected cipherService: CipherService,
    protected i18nService: I18nService,
    protected accountService: AccountService,
  ) {}

  async ngOnInit() {
    await this.init();
  }

  /** Retrieve the password history for the given cipher */
  protected async init() {
    const cipher = await this.cipherService.get(this.cipherId);
    const activeAccount = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a: { id: string | undefined }) => a)),
    );

    if (!activeAccount?.id) {
      throw new Error("Active account is not available.");
    }

    const activeUserId = activeAccount.id as UserId;
    const decCipher = await cipher.decrypt(
      await this.cipherService.getKeyForCipherKeyDecryption(cipher, activeUserId),
    );

    this.history = decCipher.passwordHistory == null ? [] : decCipher.passwordHistory;
  }
}
