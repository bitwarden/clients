import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { canAccessOrgAdmin } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { organizationPermissionsGuard } from "../../admin-console/organizations/guards/org-permissions.guard";
import { GovernanceDashboardComponent } from "../../admin-console/organizations/pam/governance-dashboard.component";

import { AccessRulesComponent } from "./access-rules.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [canAccessFeature(FeatureFlag.Pam)],
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: "access-rules",
      },
      {
        path: "access-rules",
        component: AccessRulesComponent,
        canActivate: [organizationPermissionsGuard((org) => org.canManageAccessRules)],
        data: { titleId: "pamAccessRules" },
      },
      {
        path: "governance",
        component: GovernanceDashboardComponent,
        canActivate: [organizationPermissionsGuard(canAccessOrgAdmin)],
        data: { titleId: "pamGovernanceTitle" },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccessRulesRoutingModule {}
