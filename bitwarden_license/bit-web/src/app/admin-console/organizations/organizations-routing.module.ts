import { inject, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { canAccessSettingsTab } from "@bitwarden/common/admin-console/abstractions/organization/vnext.organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { isEnterpriseOrgGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/is-enterprise-org.guard";
import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";
import { OrganizationLayoutComponent } from "@bitwarden/web-vault/app/admin-console/organizations/layouts/organization-layout.component";

import { SsoComponent } from "../../auth/sso/sso.component";

import { DomainVerificationComponent } from "./manage/domain-verification/domain-verification.component";
import { ScimComponent } from "./manage/scim.component";

const routes: Routes = [
  {
    path: "organizations/:organizationId",
    component: OrganizationLayoutComponent,
    canActivate: [authGuard, organizationPermissionsGuard()],
    children: [
      {
        path: "settings",
        canActivate: [organizationPermissionsGuard(canAccessSettingsTab)],
        children: [
          {
            path: "domain-verification",
            component: DomainVerificationComponent,
            canActivate: [organizationPermissionsGuard((org) => org.canManageDomainVerification)],
            resolve: {
              titleId: async () => {
                const configService = inject(ConfigService);
                return (await configService.getFeatureFlag(FeatureFlag.AccountDeprovisioning))
                  ? "claimedDomains"
                  : "domainVerification";
              },
            },
          },
          {
            path: "sso",
            component: SsoComponent,
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
              import(
                "../../tools/reports/member-access-report/member-access-report.component"
              ).then((mod) => mod.MemberAccessReportComponent),
            data: {
              titleId: "memberAccessReport",
            },
            canActivate: [isEnterpriseOrgGuard()],
          },
        ],
      },
      {
        path: "access-intelligence",
        loadChildren: () =>
          import("../../tools/access-intelligence/access-intelligence.module").then(
            (m) => m.AccessIntelligenceModule,
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
