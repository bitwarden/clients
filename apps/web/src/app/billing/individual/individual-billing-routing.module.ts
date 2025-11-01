import { inject, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { map } from "rxjs";

import { componentRouteSwap } from "@bitwarden/angular/utils/component-route-swap";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { AccountPaymentDetailsComponent } from "@bitwarden/web-vault/app/billing/individual/payment-details/account-payment-details.component";

import { BillingHistoryViewComponent } from "./billing-history-view.component";
import { PremiumVNextComponent } from "./premium/premium-vnext.component";
import { PremiumComponent } from "./premium/premium.component";
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
      ...componentRouteSwap(
        PremiumComponent,
        PremiumVNextComponent,
        () => {
          const configService = inject(ConfigService);
          const platformUtilsService = inject(PlatformUtilsService);

          return configService
            .getFeatureFlag$(FeatureFlag.PM24033PremiumUpgradeNewDesign)
            .pipe(map((flagValue) => flagValue === true && !platformUtilsService.isSelfHost()));
        },
        {
          data: { titleId: "goPremium" },
          path: "premium",
        },
      ),
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
