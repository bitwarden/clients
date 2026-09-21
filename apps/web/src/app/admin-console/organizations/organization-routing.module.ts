import { inject, NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { authGuard } from "@bitwarden/angular/auth/guards";
import {
  canAccessOrgAdmin,
  canAccessAccessRulesTab,
  canAccessGroupsTab,
  canAccessMembersTab,
  canAccessVaultTab,
  canAccessReportingTab,
  canAccessSettingsTab,
} from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { Organization } from "@bitwarden/common/admin-console/models/domain/organization";

import { deepLinkGuard } from "../../auth/guards/deep-link/deep-link.guard";
import { PAM_ORG_ADMIN_ROUTE } from "../../pam/pam-org-admin-route.token";

import { VaultModule } from "./collections/vault.module";
import { organizationPermissionsGuard } from "./guards/org-permissions.guard";
import { organizationRedirectGuard } from "./guards/org-redirect.guard";
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

/**
 * The Admin Console section to land a member on, in descending order of how central it is to the
 * console. Must be called inside an injection context.
 */
export function getOrganizationRoute(organization: Organization): string | undefined {
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
  // Unprovided in OSS-only builds, which mount no PAM pages. Annotated because
  // SafeInjectionToken is `@ts-strict-ignore`, so `inject` infers `unknown`.
  const pamRoute: string | null = inject(PAM_ORG_ADMIN_ROUTE, { optional: true });
  if (pamRoute != null && canAccessAccessRulesTab(organization)) {
    return pamRoute;
  }
  return undefined;
}

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class OrganizationsRoutingModule {}
