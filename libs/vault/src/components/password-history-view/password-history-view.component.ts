// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { OnInit, Component, Input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
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
   * Optional cipher view. When included `cipherId` is ignored.
   */
  @Input({ required: true }) cipher: CipherView;

  /** The password history for the cipher. */
  history: PasswordHistoryView[] = [];

  ngOnInit() {
    this.history = this.cipher.passwordHistory == null ? [] : this.cipher.passwordHistory;
  }
}
