import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { organizationPermissionsGuard } from "../../admin-console/organizations/guards/org-permissions.guard";

import { LeasingPoliciesComponent } from "./leasing-policies.component";

const routes: Routes = [
  {
    path: "",
    canActivate: [
      canAccessFeature(FeatureFlag.Pam),
      organizationPermissionsGuard((org) => org.canManageLeasingPolicies),
    ],
    children: [
      {
        path: "",
        pathMatch: "full",
        redirectTo: "leasing-policies",
      },
      {
        path: "leasing-policies",
        component: LeasingPoliciesComponent,
        data: { titleId: "pamLeasingPolicies" },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LeasingPoliciesRoutingModule {}
