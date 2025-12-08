import { NgModule } from "@angular/core";

import { SubscriberBillingClient } from "@bitwarden/web-vault/app/billing/clients";

import { ProviderWarningsService } from "./services";

@NgModule({
  providers: [ProviderWarningsService, SubscriberBillingClient],
})
export class ProviderWarningsModule {}
