import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { AuthGuard } from "@bitwarden/angular/auth/guards";
import { canAccessSettingsTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";
import { OrganizationLayoutComponent } from "@bitwarden/web-vault/app/admin-console/organizations/layouts/organization-layout.component";

import { SsoComponent } from "../../auth/sso/sso.component";

import { DeviceApprovalsComponent } from "./manage/device-approvals/device-approvals.component";
import { DomainVerificationComponent } from "./manage/domain-verification/domain-verification.component";
import { ScimComponent } from "./manage/scim.component";

const routes: Routes = [
  {
    path: "organizations/:organizationId",
    component: OrganizationLayoutComponent,
    canActivate: [AuthGuard, OrganizationPermissionsGuard],
    children: [
      {
        path: "settings",
        canActivate: [OrganizationPermissionsGuard],
        data: {
          organizationPermissions: canAccessSettingsTab,
        },
        children: [
          {
            path: "domain-verification",
            component: DomainVerificationComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "domainVerification",
              organizationPermissions: (org: Organization) => org.canManageDomainVerification,
            },
          },
          {
            path: "sso",
            component: SsoComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "singleSignOn",
              organizationPermissions: (org: Organization) => org.canManageSso,
            },
          },
          {
            path: "scim",
            component: ScimComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "scim",
              organizationPermissions: (org: Organization) => org.canManageScim,
            },
          },
          {
            path: "device-approvals",
            component: DeviceApprovalsComponent,
            canActivate: [OrganizationPermissionsGuard],
            data: {
              organizationPermissions: (org: Organization) => org.canManageDeviceApprovals,
              titleId: "deviceApprovals",
            },
          },
        ],
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationsRoutingModule {}
