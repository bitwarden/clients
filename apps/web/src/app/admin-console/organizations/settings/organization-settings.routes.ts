import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, Routes } from "@angular/router";
import { map } from "rxjs";

import { canAccessSettingsTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  canActivateImportType,
  IMPORT_DESTINATION_ROUTE_PATH,
  IMPORT_ORGANIZATION_ID_ROUTE_PARAM,
} from "@bitwarden/importer-ui";

import { organizationPermissionsGuard } from "../../organizations/guards/org-permissions.guard";
import { organizationRedirectGuard } from "../../organizations/guards/org-redirect.guard";
import { PoliciesComponent, PoliciesDeactivateGuard } from "../../organizations/policies";

import { AccountComponent } from "./account.component";
import { TwoFactorSetupComponent } from "./two-factor-setup.component";

// An unknown vendor goes back to the start of this organization's import.
const redirectToOrganizationImport = (route: ActivatedRouteSnapshot): string[] => [
  "/organizations",
  route.paramMap.get(IMPORT_ORGANIZATION_ID_ROUTE_PARAM) ?? "",
  "settings",
  "tools",
  "import",
];

export const organizationSettingsRoutes: Routes = [
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
        canDeactivate: [PoliciesDeactivateGuard],
        data: {
          titleId: "policies",
        },
      },
      {
        path: "tools",
        children: [
          {
            path: "import",
            canMatch: [
              () =>
                inject(ConfigService)
                  .getFeatureFlag$(FeatureFlag.ImportUpgrade)
                  .pipe(map((flagValue) => flagValue === true)),
            ],
            loadComponent: () =>
              import("../../../tools/import/import-shell-web.component").then(
                (mod) => mod.ImportShellWebComponent,
              ),
            canActivate: [organizationPermissionsGuard((org) => org.canAccessImport)],
            data: {
              titleId: "importNoun",
            },
            // The personal import's screens, run under this organization's id.
            children: [
              {
                path: "",
                pathMatch: "full",
                // Lazy load vendor icon set
                loadComponent: () =>
                  import("../../../tools/import/import-source-select-web.component").then(
                    (mod) => mod.ImportSourceSelectWebComponent,
                  ),
                data: {
                  titleId: "importNoun",
                },
              },
              {
                path: ":importType",
                canActivate: [canActivateImportType(redirectToOrganizationImport)],
                loadComponent: () =>
                  import("../../../tools/import/import-controls-web.component").then(
                    (mod) => mod.ImportControlsWebComponent,
                  ),
                data: {
                  titleId: "importNoun",
                },
              },
              {
                path: IMPORT_DESTINATION_ROUTE_PATH,
                canActivate: [canActivateImportType(redirectToOrganizationImport)],
                loadComponent: () =>
                  import("../../../tools/import/import-destination-web.component").then(
                    (mod) => mod.ImportDestinationWebComponent,
                  ),
                data: {
                  titleId: "importNoun",
                },
              },
            ],
          },
          {
            path: "import",
            loadComponent: () =>
              import("../../../tools/import/org-import.component").then(
                (mod) => mod.OrgImportComponent,
              ),
            canActivate: [organizationPermissionsGuard((org) => org.canAccessImport)],
            data: {
              titleId: "importNoun",
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
              titleId: "exportNoun",
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
