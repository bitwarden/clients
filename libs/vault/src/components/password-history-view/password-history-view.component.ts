// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { OnInit, Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { PasswordHistoryView } from "@bitwarden/common/vault/models/view/password-history.view";
import { ItemModule, ColorPasswordModule, IconButtonModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "vault-password-history-view",
  templateUrl: "./password-history-view.component.html",
  imports: [CommonModule, ItemModule, ColorPasswordModule, IconButtonModule, JslibModule],
})
export class PasswordHistoryViewComponent implements OnInit {
  /**
   * Optional cipher view. When included `cipherId` is ignored.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input({ required: true }) cipher: CipherView;

  /** The password history for the cipher. */
  history: PasswordHistoryView[] = [];

  ngOnInit() {
    this.history = this.cipher.passwordHistory == null ? [] : this.cipher.passwordHistory;
  }
}
