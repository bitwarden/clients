import { NgModule } from "@angular/core";

import { SubscriberBillingClient } from "@bitwarden/angular/billing/clients";

import { ProviderWarningsService } from "./services";

@NgModule({
  providers: [ProviderWarningsService, SubscriberBillingClient],
})
export class ProviderWarningsModule {}
