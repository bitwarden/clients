import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessSettingsTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { OrganizationPermissionsGuard } from "../../organizations/guards/org-permissions.guard";
import { OrganizationRedirectGuard } from "../../organizations/guards/org-redirect.guard";
import { PoliciesComponent } from "../../organizations/policies";

import { AccountComponent } from "./account.component";
import { TwoFactorSetupComponent } from "./two-factor-setup.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [OrganizationPermissionsGuard],
    data: { organizationPermissions: canAccessSettingsTab },
    children: [
      {
        path: "",
        pathMatch: "full",
        canActivate: [OrganizationRedirectGuard],
        data: {
          autoRedirectCallback: getSettingsRoute,
        },
        children: [], // This is required to make the auto redirect work,
      },
      { path: "account", component: AccountComponent, data: { titleId: "organizationInfo" } },
      {
        path: "two-factor",
        component: TwoFactorSetupComponent,
        data: { titleId: "twoStepLogin" },
      },
      {
        path: "policies",
        component: PoliciesComponent,
        canActivate: [OrganizationPermissionsGuard],
        data: {
          organizationPermissions: (org: Organization) => org.canManagePolicies,
          titleId: "policies",
        },
      },
      {
        path: "tools",
        children: [
          {
            path: "import",
            loadComponent: () =>
              import("./org-import.component").then((mod) => mod.OrgImportComponent),
            canActivate: [OrganizationPermissionsGuard],
            data: {
              titleId: "importData",
              organizationPermissions: (org: Organization) => org.canAccessImportExport,
            },
          },
          {
            path: "export",
            loadChildren: () =>
              import("../tools/vault-export/org-vault-export.module").then(
                (m) => m.OrganizationVaultExportModule,
              ),
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
  if (organization.canAccessImportExport) {
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
  return undefined;
}

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationSettingsRoutingModule {}
