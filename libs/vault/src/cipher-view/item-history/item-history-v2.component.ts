// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { ViewPasswordHistoryService } from "@bitwarden/common/vault/abstractions/view-password-history.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  CardComponent,
  LinkModule,
  SectionComponent,
  SectionHeaderComponent,
  TypographyModule,
} from "@bitwarden/components";

@Component({
  selector: "app-item-history-v2",
  templateUrl: "item-history-v2.component.html",
  standalone: true,
  imports: [
    CommonModule,
    JslibModule,
    RouterModule,
    CardComponent,
    SectionComponent,
    SectionHeaderComponent,
    TypographyModule,
    LinkModule,
  ],
})
export class ItemHistoryV2Component {
  @Input() cipher: CipherView;

  constructor(private viewPasswordHistoryService: ViewPasswordHistoryService) {}

  get isLogin() {
    return this.cipher.type === CipherType.Login;
  }

  /**
   * View the password history for the cipher.
   */
  async viewPasswordHistory() {
    await this.viewPasswordHistoryService.viewPasswordHistory(this.cipher);
  }
}
