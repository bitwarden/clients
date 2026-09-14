import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import {
  canAccessAccessIntelligence,
  canAccessSettingsTab,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { safeProvider } from "@bitwarden/ui-common";
import { isEnterpriseOrgGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/is-enterprise-org.guard";
import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";
import { OrganizationLayoutComponent } from "@bitwarden/web-vault/app/admin-console/organizations/layouts/organization-layout.component";
import { MemberActionsService } from "@bitwarden/web-vault/app/admin-console/organizations/members/services";
import { deepLinkGuard } from "@bitwarden/web-vault/app/auth/guards/deep-link/deep-link.guard";
import { BillingConstraintService } from "@bitwarden/web-vault/app/billing/members/billing-constraint/billing-constraint.service";

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
            data: { titleId: "scimV2" },
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
            // MemberAccessReportComponent opens EditMemberDialogComponent, which injects
            // MemberActionsService and BillingConstraintService. Both are plain `@Injectable()`
            // (no `providedIn`), and MembersModule is the only NgModule that provides them — this
            // route does not load MembersModule, so without these the dialog fails with NG0201.
            //
            // These have to live on the route rather than in the component's `providers`:
            // DialogService parents the dialog's injector to the environment injector DialogService
            // itself was created in, so a component-decorator (node injector) provider is never in
            // the dialog's resolution chain. Route `providers` land in an environment injector,
            // which is. The report component itself uses none of these two services.
            providers: [safeProvider(MemberActionsService), safeProvider(BillingConstraintService)],
            data: {
              titleId: "memberAccessReport",
            },
            canActivate: [isEnterpriseOrgGuard()],
          },
        ],
      },
      {
        path: "access-intelligence",
        canActivate: [organizationPermissionsGuard(canAccessAccessIntelligence)],
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
      {
        path: "pam",
        loadChildren: () => import("../../pam/pam-routing.module").then((m) => m.PamRoutingModule),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationsRoutingModule {}
