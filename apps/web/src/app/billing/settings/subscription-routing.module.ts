import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { BillingHistoryViewComponent } from "../../billing/settings/billing-history-view.component";
import { PaymentMethodComponent } from "../../billing/settings/payment-method.component";
import { UserSubscriptionComponent } from "../../billing/settings/user-subscription.component";
import { PremiumComponent } from "../../vault/settings/premium.component";

import { SubscriptionComponent } from "./subscription.component";

const routes: Routes = [
  {
    path: "",
    component: SubscriptionComponent,
    data: { titleId: "subscription" },
    children: [
      { path: "", pathMatch: "full", redirectTo: "premium" },
      {
        path: "user-subscription",
        component: UserSubscriptionComponent,
        data: { titleId: "premiumMembership" },
      },
      {
        path: "premium",
        component: PremiumComponent,
        data: { titleId: "goPremium" },
      },
      {
        path: "payment-method",
        component: PaymentMethodComponent,
        data: { titleId: "paymentMethod" },
      },
      {
        path: "billing-history",
        component: BillingHistoryViewComponent,
        data: { titleId: "billingHistory" },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class SubscriptionRoutingModule {}
