import { NgModule } from "@angular/core";

import { BaseCardComponent, BreadcrumbsModule } from "@bitwarden/components";
import { PricingCardComponent } from "@bitwarden/pricing";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
} from "@bitwarden/web-vault/app/billing/payment/components";

import { HeaderModule } from "../../layouts/header/header.module";
import { BillingSharedModule } from "../shared";

import { BillingHistoryViewComponent } from "./billing-history-view.component";
import { IndividualBillingRoutingModule } from "./individual-billing-routing.module";
import { SubscriptionComponent } from "./subscription.component";

@NgModule({
  imports: [
    IndividualBillingRoutingModule,
    BillingSharedModule,
    BreadcrumbsModule,
    HeaderModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
    PricingCardComponent,
    BaseCardComponent,
  ],
  declarations: [SubscriptionComponent, BillingHistoryViewComponent],
})
export class IndividualBillingModule {}
