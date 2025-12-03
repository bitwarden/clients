import { NgModule } from "@angular/core";

import { BaseCardComponent } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { BillingSharedModule } from "../shared";

import { BillingHistoryViewComponent } from "./billing-history-view.component";
import { IndividualBillingRoutingModule } from "./individual-billing-routing.module";
import { CloudHostedPremiumComponent } from "./premium/cloud-hosted-premium.component";
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
  declarations: [
    SubscriptionComponent,
    BillingHistoryViewComponent,
    UserSubscriptionComponent,
    CloudHostedPremiumComponent,
  ],
})
export class IndividualBillingModule {}
