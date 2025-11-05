import { inject, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { map } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AccountPaymentDetailsComponent } from "@bitwarden/web-vault/app/billing/individual/payment-details/account-payment-details.component";
import { SelfHostedPremiumComponent } from "@bitwarden/web-vault/app/billing/individual/premium/self-hosted-premium.component";

import { BillingHistoryViewComponent } from "./billing-history-view.component";
import { CloudHostedPremiumVNextComponent } from "./premium/cloud-hosted-premium-vnext.component";
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
      // Route 2: Cloud Hosted + FF -> CloudHostedPremiumVNextComponent
      {
        path: "premium",
        component: CloudHostedPremiumVNextComponent,
        data: { titleId: "goPremium" },
        canMatch: [
          () => {
            const configService = inject(ConfigService);
            const platformUtilsService = inject(PlatformUtilsService);

            return configService
              .getFeatureFlag$(FeatureFlag.PM24033PremiumUpgradeNewDesign)
              .pipe(map((flagValue) => flagValue === true && !platformUtilsService.isSelfHost()));
          },
        ],
      },
      // Route 3: Cloud Hosted + FF Disabled -> CloudHostedPremiumComponent (Fallback)
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
