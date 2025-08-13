// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import {
  canAccessOrgAdmin,
  canAccessGroupsTab,
  canAccessMembersTab,
  canAccessVaultTab,
  canAccessReportingTab,
  canAccessSettingsTab,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { deepLinkGuard } from "../../auth/guards/deep-link/deep-link.guard";

import { VaultModule } from "./collections/vault.module";
import { organizationPermissionsGuard } from "./guards/org-permissions.guard";
import { organizationRedirectGuard } from "./guards/org-redirect.guard";
import { AdminConsoleIntegrationsComponent } from "./integrations/integrations.component";
import { OrganizationLayoutComponent } from "./layouts/organization-layout.component";
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
        path: "integrations",
        canActivate: [organizationPermissionsGuard(canAccessIntegrations)],
        component: AdminConsoleIntegrationsComponent,
        data: {
          titleId: "integrations",
        },
      },
      {
        path: "settings",
        loadChildren: () =>
          import("./settings/organization-settings.module").then(
            (m) => m.OrganizationSettingsModule,
          ),
      },
      {
        path: "members",
        loadChildren: () => import("./members").then((m) => m.MembersModule),
      },
      {
        component: GroupsComponent,
        path: "groups",
        canActivate: [organizationPermissionsGuard(canAccessGroupsTab)],
        data: {
          titleId: "groups",
        },
      },
      {
        path: "reporting",
        loadChildren: () =>
          import("../organizations/reporting/organization-reporting.module").then(
            (m) => m.OrganizationReportingModule,
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

function getOrganizationRoute(organization: Organization): string {
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

function canAccessIntegrations(organization: Organization) {
  return organization.canAccessIntegrations;
}

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationsRoutingModule {}
