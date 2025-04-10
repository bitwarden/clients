import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessMembersTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";

import { OrganizationSponsoredFamiliesComponent } from "../../../billing/members/organization-sponsored-families.component";
import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

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
    component: OrganizationSponsoredFamiliesComponent,
    canActivate: [organizationPermissionsGuard(canAccessMembersTab)],
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
