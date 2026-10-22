import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import {
  canAccessOrgAdmin,
  canAccessGroupsTab,
  canAccessMembersTab,
  canAccessVaultTab,
  canAccessReportingTab,
  canAccessSettingsTab,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { deepLinkGuard } from "../../auth/guards/deep-link/deep-link.guard";

import { VaultModule } from "./collections/vault.module";
import { organizationPermissionsGuard } from "./guards/org-permissions.guard";
import { organizationRedirectGuard } from "./guards/org-redirect.guard";
import { OrganizationLayoutComponent } from "./layouts/organization-layout.component";
import { GroupsV2Component } from "./manage/groups-v2.component";
import { GroupsComponent } from "./manage/groups.component";

const routes: Routes = [
  {
    path: ":organizationId",
    component: OrganizationLayoutComponent,
    canActivate: [deepLinkGuard(), authGuard, organizationPermissionsGuard(canAccessOrgAdmin)],
    children: [
      {
        path: "",
        pathMatch: "full",
        canActivate: [organizationRedirectGuard(getOrganizationRoute)],
        children: [], // This is required to make the auto redirect work, },
      },
      {
        path: "vault",
        loadChildren: () => VaultModule,
      },
      {
        path: "settings",
        loadChildren: () =>
          import("./settings/organization-settings.routes").then(
            (m) => m.organizationSettingsRoutes,
          ),
      },
      {
        path: "members",
        loadChildren: () => import("./members").then((m) => m.membersRoutes),
      },
      ...featureFlaggedRoute({
        defaultComponent: GroupsComponent,
        flaggedComponent: GroupsV2Component,
        featureFlag: FeatureFlag.GroupsComponentRefactor,
        routeOptions: {
          path: "groups",
          canActivate: [organizationPermissionsGuard(canAccessGroupsTab)],
          data: {
            titleId: "groups",
          },
        },
      }),
      {
        path: "reporting",
        loadChildren: () =>
          import("../organizations/reporting/organization-reporting.routes").then(
            (m) => m.organizationReportingRoutes,
          ),
      },
      {
        path: "billing",
        loadChildren: () =>
          import("../../billing/organizations/organization-billing.module").then(
            (m) => m.OrganizationBillingModule,
          ),
      },
    ],
  },
];

function getOrganizationRoute(organization: Organization): string | undefined {
  if (canAccessVaultTab(organization)) {
    return "vault";
  }
  if (canAccessMembersTab(organization)) {
    return "members";
  }
  if (canAccessGroupsTab(organization)) {
    return "groups";
  }
  if (canAccessReportingTab(organization)) {
    return "reporting";
  }
  if (canAccessSettingsTab(organization)) {
    return "settings";
  }
  return undefined;
}

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationsRoutingModule {}
