import { Component, input } from "@angular/core";

import { BankAccountView } from "@bitwarden/common/vault/models/view/bank-account.view";
import {
  CopyClickDirective,
  SectionHeaderComponent,
  TypographyModule,
  FormFieldModule,
  IconButtonModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { ReadOnlyCipherCardComponent } from "../read-only-cipher-card/read-only-cipher-card.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-bank-account-view",
  templateUrl: "bank-account-view.component.html",
  imports: [
    I18nPipe,
    CopyClickDirective,
    SectionHeaderComponent,
    ReadOnlyCipherCardComponent,
    TypographyModule,
    FormFieldModule,
    IconButtonModule,
  ],
})
export class BankAccountViewComponent {
  readonly bankAccount = input.required<BankAccountView>();

  revealAccountNumber = false;
  revealPin = false;
}
