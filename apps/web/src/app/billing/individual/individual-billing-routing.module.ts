import { inject, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { hasPremiumPersonallyGuard } from "@bitwarden/web-vault/app/billing/guards/has-premium-personally.guard";
import { AccountPaymentDetailsComponent } from "@bitwarden/web-vault/app/billing/individual/payment-details/account-payment-details.component";
import { SelfHostedPremiumComponent } from "@bitwarden/web-vault/app/billing/individual/premium/self-hosted-premium.component";
import { CloudHostedAccountSubscriptionComponent } from "@bitwarden/web-vault/app/billing/individual/subscription/cloud-hosted-account-subscription.component";
import { SelfHostedAccountSubscriptionComponent } from "@bitwarden/web-vault/app/billing/individual/subscription/self-hosted-account-subscription.component";

import { BillingHistoryViewComponent } from "./billing-history-view.component";
import { CloudHostedPremiumComponent } from "./premium/cloud-hosted-premium.component";
import { SubscriptionComponent } from "./subscription.component";
import { UserSubscriptionComponent } from "./user-subscription.component";

const isSubscriptionPageEnabled = () =>
  inject(ConfigService)
    .getFeatureFlag$(FeatureFlag.PM29594_UpdateIndividualSubscriptionPage)
    .pipe(map((flagValue) => flagValue === true));

const isSelfHosted = () => inject(PlatformUtilsService).isSelfHost();

const routes: Routes = [
  {
    path: "",
    component: SubscriptionComponent,
    data: { titleId: "subscription" },
    children: [
      { path: "", pathMatch: "full", redirectTo: "user-subscription" },
      /**
       * Three-Route Matching Strategy for /user-subscription:
       *
       * Routes are evaluated in order using canMatch guards. The first matching route is selected.
       *
       * 1. Feature flag ON + Self-Hosted → SelfHostedAccountSubscriptionComponent
       *    (Redirects to /premium if the user lacks a personal premium subscription)
       * 2. Feature flag ON (fallthrough for cloud-hosted) → CloudHostedAccountSubscriptionComponent
       * 3. Default (flag OFF) → UserSubscriptionComponent
       */
      {
        path: "user-subscription",
        component: SelfHostedAccountSubscriptionComponent,
        data: { titleId: "premiumMembership" },
        canMatch: [isSubscriptionPageEnabled, isSelfHosted],
        canActivate: [hasPremiumPersonallyGuard],
      },
      {
        path: "user-subscription",
        component: CloudHostedAccountSubscriptionComponent,
        data: { titleId: "premiumMembership" },
        canMatch: [isSubscriptionPageEnabled],
      },
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
        canMatch: [isSelfHosted],
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
