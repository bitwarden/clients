import { NgModule } from "@angular/core";

import {
  OrganizationBillingClient,
  SubscriberBillingClient,
} from "@bitwarden/web-vault/app/billing/clients";
import { OrganizationWarningsService } from "@bitwarden/web-vault/app/billing/organizations/warnings/services";

@NgModule({
  providers: [OrganizationBillingClient, OrganizationWarningsService, SubscriberBillingClient],
})
export class OrganizationWarningsModule {}
