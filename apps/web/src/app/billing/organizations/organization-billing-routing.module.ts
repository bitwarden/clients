import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessBillingTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { OrganizationPaymentDetailsComponent } from "@bitwarden/web-vault/app/billing/organizations/payment-details/organization-payment-details.component";

import { organizationPermissionsGuard } from "../../admin-console/organizations/guards/org-permissions.guard";
import { organizationIsUnmanaged } from "../../billing/guards/organization-is-unmanaged.guard";
import { WebPlatformUtilsService } from "../../core/web-platform-utils.service";

import { OrgBillingHistoryViewComponent } from "./organization-billing-history-view.component";
import { OrganizationSubscriptionCloudComponent } from "./organization-subscription-cloud.component";
import { OrganizationSubscriptionSelfhostComponent } from "./organization-subscription-selfhost.component";
import { OrganizationPaymentMethodComponent } from "./payment-method/organization-payment-method.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [organizationPermissionsGuard(canAccessBillingTab)],
    children: [
      { path: "", pathMatch: "full", redirectTo: "subscription" },
      {
        path: "subscription",
        component: WebPlatformUtilsService.isSelfHost()
          ? OrganizationSubscriptionSelfhostComponent
          : OrganizationSubscriptionCloudComponent,
        data: { titleId: "subscription" },
      },
      {
        path: "payment-method",
        component: OrganizationPaymentMethodComponent,
        canActivate: [
          organizationPermissionsGuard((org) => org.canEditPaymentMethods),
          organizationIsUnmanaged,
        ],
        data: {
          titleId: "paymentMethod",
        },
      },
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
