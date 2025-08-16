// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { SubscriptionHiddenIcon } from "@bitwarden/assets/svg";

@Component({
  selector: "app-org-subscription-hidden",
  template: `<div class="tw-flex tw-flex-col tw-items-center tw-text-info">
    <bit-icon [icon]="subscriptionHiddenIcon"></bit-icon>
    <p class="tw-font-bold">{{ "billingManagedByProvider" | i18n: providerName }}</p>
    <p>{{ "billingContactProviderForAssistance" | i18n }}</p>
  </div>`,
  standalone: false,
})
export class SubscriptionHiddenComponent {
  @Input() providerName: string;
  subscriptionHiddenIcon = SubscriptionHiddenIcon;
}
