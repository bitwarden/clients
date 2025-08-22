import { Component } from "@angular/core";

import { PartnerTrustIcon } from "@bitwarden/assets/svg";

@Component({
  selector: "app-no-invoices",
  template: `<div class="tw-flex tw-flex-col tw-items-center tw-text-info">
    <bit-icon [icon]="icon"></bit-icon>
    <p class="tw-mt-4">{{ "noInvoicesToList" | i18n }}</p>
  </div>`,
  standalone: false,
})
export class NoInvoicesComponent {
  icon = PartnerTrustIcon;
}
