import { inject, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AccountPaymentDetailsComponent } from "@bitwarden/web-vault/app/billing/individual/payment-details/account-payment-details.component";
import { SelfHostedPremiumComponent } from "@bitwarden/web-vault/app/billing/individual/premium/self-hosted-premium.component";

import { BillingHistoryViewComponent } from "./billing-history-view.component";
import { CloudHostedPremiumComponent } from "./premium/cloud-hosted-premium.component";
import { SubscriptionComponent } from "./subscription.component";
import { UserSubscriptionComponent } from "./user-subscription.component";

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
      /**
       * Two-Route Matching Strategy for /premium:
       *
       * Routes are evaluated in order using canMatch guards. The first route that matches will be selected.
       *
       * 1. Self-Hosted Environment → SelfHostedPremiumComponent
       *    - Matches when platformUtilsService.isSelfHost() === true
       *
       * 2. Cloud-Hosted (default) → CloudHostedPremiumComponent
       *    - Evaluated when Route 1 doesn't match (not self-hosted)
       */
      // Route 1: Self-Hosted -> SelfHostedPremiumComponent
      {
        path: "premium",
        component: SelfHostedPremiumComponent,
        data: { titleId: "goPremium" },
        canMatch: [
          () => {
            const platformUtilsService = inject(PlatformUtilsService);
            return platformUtilsService.isSelfHost();
          },
        ],
      },
      // Route 2: Cloud Hosted (default) -> CloudHostedPremiumComponent
      {
        path: "premium",
        component: CloudHostedPremiumComponent,
        data: { titleId: "goPremium" },
      },
      {
        path: "payment-details",
        component: AccountPaymentDetailsComponent,
        data: { titleId: "paymentDetails" },
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
export class IndividualBillingRoutingModule {}
