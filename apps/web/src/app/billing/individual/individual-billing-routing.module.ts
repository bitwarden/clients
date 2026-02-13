import { inject, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AccountPaymentDetailsComponent } from "@bitwarden/web-vault/app/billing/individual/payment-details/account-payment-details.component";
import { SelfHostedPremiumComponent } from "@bitwarden/web-vault/app/billing/individual/premium/self-hosted-premium.component";
import { AccountSubscriptionComponent } from "@bitwarden/web-vault/app/billing/individual/subscription/account-subscription.component";

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
      { path: "", pathMatch: "full", redirectTo: "user-subscription" },
      ...featureFlaggedRoute({
        defaultComponent: UserSubscriptionComponent,
        flaggedComponent: AccountSubscriptionComponent,
        featureFlag: FeatureFlag.PM29594_UpdateIndividualSubscriptionPage,
        routeOptions: {
          path: "user-subscription",
          data: { titleId: "premiumMembership" },
        },
      }),
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
