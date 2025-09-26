import { Component } from "@angular/core";

import { CreditCardIcon } from "@bitwarden/assets/svg";

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
