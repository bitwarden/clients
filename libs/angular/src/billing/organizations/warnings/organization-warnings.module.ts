import { NgModule } from "@angular/core";

import {
  OrganizationBillingClient,
  SubscriberBillingClient,
} from "@bitwarden/angular/billing/clients";

import { OrganizationWarningsService } from "./services";

@NgModule({
  providers: [OrganizationBillingClient, OrganizationWarningsService, SubscriberBillingClient],
})
export class OrganizationWarningsModule {}
