import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { organizationPermissionsGuard } from "@bitwarden/web-vault/app/admin-console/organizations/guards/org-permissions.guard";

import { AccessAuditComponent } from "./access-audit/access-audit.component";
import { AccessNameResolverService } from "./access-requests/access-name-resolver.service";
import {
  AccessRuleEditComponent,
  accessRuleEditDiscardGuard,
} from "./access-rules/access-rule-edit/access-rule-edit.component";
import { AccessRulesComponent } from "./access-rules/access-rules.component";

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
        path: "audit",
        canActivate: [organizationPermissionsGuard((org) => org.canAccessEventLogs)],
        component: AccessAuditComponent,
        // Route-provided (the service is @Injectable, not root): the audit table resolves cipher and
        // collection names from local vault state the same way the "My access" surfaces do.
        providers: [AccessNameResolverService],
        data: { titleId: "pamAuditLog" },
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
            canDeactivate: [accessRuleEditDiscardGuard],
            data: { titleId: "pamAccessRuleCreateTitle" },
          },
          {
            path: ":accessRuleId",
            component: AccessRuleEditComponent,
            canDeactivate: [accessRuleEditDiscardGuard],
            data: { titleId: "pamAccessRuleEditTitle" },
          },
        ],
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class PamRoutingModule {}
