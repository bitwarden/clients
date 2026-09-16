import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { canAccessBillingTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { OrganizationPaymentDetailsComponent } from "@bitwarden/web-vault/app/billing/organizations/payment-details/organization-payment-details.component";

import { organizationPermissionsGuard } from "../../admin-console/organizations/guards/org-permissions.guard";
import { organizationIsUnmanaged } from "../../billing/guards/organization-is-unmanaged.guard";
import { WebPlatformUtilsService } from "../../core/web-platform-utils.service";

import { OrgBillingHistoryViewComponent } from "./organization-billing-history-view.component";
import { OrganizationSubscriptionCloudVNextComponent } from "./organization-subscription-cloud-vnext.component";
import { OrganizationSubscriptionCloudComponent } from "./organization-subscription-cloud.component";
import { OrganizationSubscriptionSelfhostComponent } from "./organization-subscription-selfhost.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [organizationPermissionsGuard(canAccessBillingTab)],
    children: [
      { path: "", pathMatch: "full", redirectTo: "subscription" },
      ...(WebPlatformUtilsService.isSelfHost()
        ? [
            {
              path: "subscription",
              component: OrganizationSubscriptionSelfhostComponent,
              data: { titleId: "subscription" },
            },
          ]
        : featureFlaggedRoute({
            defaultComponent: OrganizationSubscriptionCloudComponent,
            flaggedComponent: OrganizationSubscriptionCloudVNextComponent,
            featureFlag: FeatureFlag.PM36631_PreviewDrivenCart,
            routeOptions: {
              path: "subscription",
              data: { titleId: "subscription" },
            },
          })),
      {
        path: "payment-details",
        component: OrganizationPaymentDetailsComponent,
        canActivate: [
          organizationPermissionsGuard((org) => org.canEditPaymentMethods),
          organizationIsUnmanaged,
        ],
        data: {
          titleId: "paymentDetails",
        },
      },
      {
        path: "history",
        component: OrgBillingHistoryViewComponent,
        canActivate: [
          organizationPermissionsGuard((org) => org.canViewBillingHistory),
          organizationIsUnmanaged,
        ],
        data: {
          titleId: "billingHistory",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationBillingRoutingModule {}
