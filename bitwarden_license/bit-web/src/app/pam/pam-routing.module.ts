import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { canAccessOrgAdmin } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { AccessRuleEditComponent } from "./access-rules/access-rule-edit/access-rule-edit.component";
import { AccessRulesComponent } from "./access-rules/access-rules.component";
import { GovernanceDashboardComponent } from "./governance-dashboard/governance-dashboard.component";

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
        canActivate: [organizationPermissionsGuard((org) => org.canManageAccessRules)],
        children: [
          {
            path: "",
            component: AccessRulesComponent,
            data: { titleId: "pamAccessRules" },
          },
          // List "new" before ":accessRuleId" so the literal path wins.
          {
            path: "new",
            component: AccessRuleEditComponent,
            data: { titleId: "pamAccessRuleCreateTitle" },
          },
          {
            path: ":accessRuleId",
            component: AccessRuleEditComponent,
            data: { titleId: "pamAccessRuleEditTitle" },
          },
        ],
      },
      {
        path: "approver-inbox",
        canActivate: [organizationPermissionsGuard((org) => org.canManageAccessRules)],
        data: { titleId: "pamInboxTitle" },
        // The shell + its routable tabs (Approvals / My requests / Audit log), shared with the
        // end-user OSS mount. Page-scoped services are provided on the shell route inside.
        loadChildren: () =>
          import("./approver-inbox/approver-inbox.routes").then((m) => m.approverInboxRoutes),
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
export class PamRoutingModule {}
