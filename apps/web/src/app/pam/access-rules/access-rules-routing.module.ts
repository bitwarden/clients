import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { organizationPermissionsGuard } from "../../admin-console/organizations/guards/org-permissions.guard";

import { AccessRulesComponent } from "./access-rules.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [
      canAccessFeature(FeatureFlag.Pam),
      organizationPermissionsGuard((org) => org.canManageAccessRules),
    ],
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: "access-rules",
      },
      {
        path: "access-rules",
        component: AccessRulesComponent,
        data: { titleId: "pamAccessRules" },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AccessRulesRoutingModule {}
