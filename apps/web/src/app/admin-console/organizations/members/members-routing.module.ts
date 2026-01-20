import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { canAccessMembersTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { FreeBitwardenFamiliesComponent } from "../../../billing/members/free-bitwarden-families.component";
import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { canAccessSponsoredFamilies } from "./../../../billing/guards/can-access-sponsored-families.guard";
import { MembersComponent } from "./deprecated_members.component";
import { vNextMembersComponent } from "./members.component";

const routes: Routes = [
  ...featureFlaggedRoute({
    defaultComponent: MembersComponent,
    flaggedComponent: vNextMembersComponent,
    featureFlag: FeatureFlag.MembersComponentRefactor,
    routeOptions: {
      path: "",
      canActivate: [organizationPermissionsGuard(canAccessMembersTab)],
      data: {
        titleId: "members",
      },
    },
  }),
  {
    path: "sponsored-families",
    component: FreeBitwardenFamiliesComponent,
    canActivate: [organizationPermissionsGuard(canAccessMembersTab), canAccessSponsoredFamilies],
    data: {
      titleId: "sponsoredFamilies",
    },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MembersRoutingModule {}
