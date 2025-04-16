import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessMembersTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

import { FreeBitwardenFamiliesComponent } from "../../../billing/members/free-bitwarden-families.component";
import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { canAccessSponsoredFamilies } from "./../../../billing/guards/can-access-sponsored-families.guard";
import { MembersComponent } from "./members.component";

const routes: Routes = [
  {
    path: "",
    component: MembersComponent,
    canActivate: [organizationPermissionsGuard(canAccessMembersTab)],
    data: {
      titleId: "members",
    },
  },
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
