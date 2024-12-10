// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, NgModule } from "@angular/core";
import { CanMatchFn, RouterModule, Routes } from "@angular/router";
import { map } from "rxjs";

import { canAccessSettingsTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { organizationPermissionsGuard } from "../../organizations/guards/org-permissions.guard";
import { organizationRedirectGuard } from "../../organizations/guards/org-redirect.guard";
import { PoliciesComponent } from "../../organizations/policies";

import { AccountComponent } from "./account.component";
import { TwoFactorSetupComponent } from "./two-factor-setup.component";

const removeProviderExportPermission$: CanMatchFn = () =>
  inject(ConfigService)
    .getFeatureFlag$(FeatureFlag.PM11360RemoveProviderExportPermission)
    .pipe(map((removeProviderExport) => removeProviderExport === true));

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
        canActivate: [organizationPermissionsGuard((org) => org.canManagePolicies)],
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
              import("./org-import.component").then((mod) => mod.OrgImportComponent),
            canActivate: [organizationPermissionsGuard((org) => org.canAccessImport)],
            data: {
              titleId: "importData",
            },
          },

          // Export routing is temporarily duplicated to set the flag value passed into org.canAccessExport
          {
            path: "export",
            loadComponent: () =>
              import("../tools/vault-export/org-vault-export.component").then(
                (mod) => mod.OrganizationVaultExportComponent,
              ),
            canMatch: [removeProviderExportPermission$], // if this matches, the flag is ON
            canActivate: [organizationPermissionsGuard((org) => org.canAccessExport(true))],
            data: {
              titleId: "exportVault",
            },
          },
          {
            path: "export",
            loadComponent: () =>
              import("../tools/vault-export/org-vault-export.component").then(
                (mod) => mod.OrganizationVaultExportComponent,
              ),
            canActivate: [organizationPermissionsGuard((org) => org.canAccessExport(false))],
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
  return undefined;
}

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationSettingsRoutingModule {}
