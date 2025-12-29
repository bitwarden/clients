import { NgModule } from "@angular/core";

import { BaseCardComponent } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";
import { AdditionalOptionsCardComponent, StorageCardComponent } from "@bitwarden/subscription";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { BillingSharedModule } from "../shared";

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
    StorageCardComponent,
    AdditionalOptionsCardComponent,
  ],
  declarations: [SubscriptionComponent, BillingHistoryViewComponent, UserSubscriptionComponent],
})
export class IndividualBillingModule {}
