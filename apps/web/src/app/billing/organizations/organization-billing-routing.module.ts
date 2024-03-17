import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessBillingTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { OrganizationPermissionsGuard } from "../../admin-console/organizations/guards/org-permissions.guard";
import { WebPlatformUtilsService } from "../../core/web-platform-utils.service";
import { PaymentMethodComponent } from "../shared";

import { OrgBillingHistoryViewComponent } from "./organization-billing-history-view.component";
import { OrganizationSubscriptionCloudComponent } from "./organization-subscription-cloud.component";
import { OrganizationSubscriptionSelfhostComponent } from "./organization-subscription-selfhost.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [OrganizationPermissionsGuard],
    data: { organizationPermissions: canAccessBillingTab },
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
        component: PaymentMethodComponent,
        canActivate: [OrganizationPermissionsGuard],
        data: {
          titleId: "paymentMethod",
          organizationPermissions: (org: Organization) => org.canEditPaymentMethods,
        },
      },
      {
        path: "history",
        component: OrgBillingHistoryViewComponent,
        canActivate: [OrganizationPermissionsGuard],
        data: {
          titleId: "billingHistory",
          organizationPermissions: (org: Organization) => org.canViewBillingHistory,
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
