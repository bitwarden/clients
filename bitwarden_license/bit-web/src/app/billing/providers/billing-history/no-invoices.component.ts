import { Component } from "@angular/core";

import { CreditCardIcon } from "@bitwarden/assets/svg";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-no-invoices",
  template: `<bit-no-items [icon]="icon">
    <div slot="title">{{ "noInvoicesToList" | i18n }}</div>
  </bit-no-items>`,
  standalone: false,
})
export class NoInvoicesComponent {
  icon = CreditCardIcon;
}
