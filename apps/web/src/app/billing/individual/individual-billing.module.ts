import { NgModule } from "@angular/core";

import { BillingSharedModule } from "@bitwarden/angular/billing/shared";
import { EnterBillingAddressComponent, EnterPaymentMethodComponent , BaseCardComponent } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";

import { HeaderModule } from "../../layouts/header/header.module";

import { BillingHistoryViewComponent } from "./billing-history-view.component";
import { IndividualBillingRoutingModule } from "./individual-billing-routing.module";
import { SubscriptionComponent } from "./subscription.component";
import { UserSubscriptionComponent } from "./user-subscription.component";

@NgModule({
  imports: [
    IndividualBillingRoutingModule,
    BillingSharedModule,
    HeaderModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
    PricingCardComponent,
    BaseCardComponent,
  ],
  declarations: [SubscriptionComponent, BillingHistoryViewComponent, UserSubscriptionComponent],
})
export class IndividualBillingModule {}
