import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { canAccessSettingsTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { isEnterpriseOrgGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/is-enterprise-org.guard";
import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";
import { OrganizationLayoutComponent } from "@bitwarden/web-vault/app/admin-console/organizations/layouts/organization-layout.component";
import { deepLinkGuard } from "@bitwarden/web-vault/app/auth/guards/deep-link/deep-link.guard";

import { SsoManageComponent } from "../../auth/sso/sso-manage.component";

import { DomainVerificationComponent } from "./manage/domain-verification/domain-verification.component";
import { ScimComponent } from "./manage/scim.component";

const routes: Routes = [
  {
    path: "organizations/:organizationId",
    component: OrganizationLayoutComponent,
    canActivate: [deepLinkGuard(), authGuard, organizationPermissionsGuard()],
    children: [
      {
        path: "settings",
        canActivate: [organizationPermissionsGuard(canAccessSettingsTab)],
        children: [
          {
            path: "domain-verification",
            component: DomainVerificationComponent,
            canActivate: [organizationPermissionsGuard((org) => org.canManageDomainVerification)],
            data: {
              titleId: "claimedDomains",
            },
          },
          {
            path: "sso",
            component: SsoManageComponent,
            canActivate: [organizationPermissionsGuard((org) => org.canManageSso)],
            data: {
              titleId: "singleSignOn",
            },
          },
          {
            path: "scim",
            component: ScimComponent,
            canActivate: [organizationPermissionsGuard((org) => org.canManageScim)],
            data: {
              titleId: "scim",
            },
          },
          {
            path: "device-approvals",
            loadComponent: () =>
              import("./manage/device-approvals/device-approvals.component").then(
                (mod) => mod.DeviceApprovalsComponent,
              ),
            canActivate: [organizationPermissionsGuard((org) => org.canManageDeviceApprovals)],
            data: {
              titleId: "deviceApprovals",
            },
          },
        ],
      },
      {
        path: "reporting/reports",
        canActivate: [authGuard, organizationPermissionsGuard((org) => org.canAccessReports)],
        children: [
          {
            path: "member-access-report",
            loadComponent: () =>
              import("../../dirt/reports/member-access-report/member-access-report.component").then(
                (mod) => mod.MemberAccessReportComponent,
              ),
            data: {
              titleId: "memberAccessReport",
            },
            canActivate: [isEnterpriseOrgGuard()],
          },
        ],
      },
      {
        path: "access-intelligence",
        canActivate: [organizationPermissionsGuard((org) => org.canAccessReports)],
        loadChildren: () =>
          import("../../dirt/access-intelligence/access-intelligence.module").then(
            (m) => m.AccessIntelligenceModule,
          ),
      },
      {
        path: "integrations",
        canActivate: [organizationPermissionsGuard((org) => org.canAccessIntegrations)],
        loadChildren: () =>
          import("../../dirt/organization-integrations/organization-integrations.module").then(
            (m) => m.OrganizationIntegrationsModule,
          ),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationsRoutingModule {}
