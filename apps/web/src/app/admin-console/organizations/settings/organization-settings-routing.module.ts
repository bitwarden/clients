import { NgModule, inject } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";
import { map } from "rxjs";

import { canAccessSettingsTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { OrganizationBillingServiceAbstraction } from "@bitwarden/common/billing/abstractions";

import { organizationPermissionsGuard } from "../../organizations/guards/org-permissions.guard";
import { organizationRedirectGuard } from "../../organizations/guards/org-redirect.guard";
import { PoliciesComponent } from "../../organizations/policies";

import { AccountComponent } from "./account.component";
import { TwoFactorSetupComponent } from "./two-factor-setup.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [organizationPermissionsGuard(canAccessSettingsTab)],
    children: [
      {
        path: "",
        pathMatch: "full",
        canActivate: [organizationRedirectGuard(getSettingsRoute)],
        children: [], // This is required to make the auto redirect work,
      },
      {
        path: "account",
        component: AccountComponent,
        canActivate: [organizationPermissionsGuard((o) => o.isOwner)],
        data: {
          titleId: "organizationInfo",
        },
      },
      {
        path: "two-factor",
        component: TwoFactorSetupComponent,
        canActivate: [organizationPermissionsGuard((o) => o.use2fa && o.isOwner)],
        data: {
          titleId: "twoStepLogin",
        },
      },
      {
        path: "policies",
        component: PoliciesComponent,
        canActivate: [
          organizationPermissionsGuard((o: Organization) => {
            const organizationBillingService = inject(OrganizationBillingServiceAbstraction);
            return organizationBillingService
              .isBreadcrumbingPoliciesEnabled$(o)
              .pipe(map((isBreadcrumbingEnabled) => o.canManagePolicies || isBreadcrumbingEnabled));
          }),
        ],
        data: {
          titleId: "policies",
        },
      },
      {
        path: "tools",
        children: [
          {
            path: "import",
            loadComponent: () =>
              import("../../../tools/import/org-import.component").then(
                (mod) => mod.OrgImportComponent,
              ),
            canActivate: [organizationPermissionsGuard((org) => org.canAccessImport)],
            data: {
              titleId: "importData",
            },
          },
          {
            path: "export",
            loadComponent: () =>
              import("../../../tools/vault-export/org-vault-export.component").then(
                (mod) => mod.OrganizationVaultExportComponent,
              ),
            canActivate: [organizationPermissionsGuard((org) => org.canAccessExport)],
            data: {
              titleId: "exportVault",
            },
          },
        ],
      },
    ],
  },
];

function getSettingsRoute(organization: Organization) {
  if (organization.isOwner) {
    return "account";
  }
  if (organization.canManagePolicies) {
    return "policies";
  }
  if (organization.canAccessImport) {
    return ["tools", "import"];
  }
  if (organization.canManageSso) {
    return "sso";
  }
  if (organization.canManageScim) {
    return "scim";
  }
  if (organization.canManageDeviceApprovals) {
    return "device-approvals";
  }

  return "/";
}

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationSettingsRoutingModule {}
