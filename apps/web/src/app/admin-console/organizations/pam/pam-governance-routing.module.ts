import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessOrgAdmin } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { GovernanceDashboardComponent } from "./governance-dashboard.component";

/**
 * PAM credential-leasing governance routes (PM-37277).
 *
 * Mounted at `/organizations/{organizationId}/pam`. The org-admin gate is
 * applied here (independent of the parent canAccessOrgAdmin gate) so the
 * leasing-governance UI is unreachable to non-admins even if routing is
 * reused elsewhere in the future.
 */
const routes: Routes = [
  {
    path: "",
    canActivate: [organizationPermissionsGuard(canAccessOrgAdmin)],
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: "governance",
      },
      {
        path: "governance",
        component: GovernanceDashboardComponent,
        data: {
          titleId: "pamGovernanceTitle",
        },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PamGovernanceRoutingModule {}
