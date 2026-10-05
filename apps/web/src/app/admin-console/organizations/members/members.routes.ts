import { Routes } from "@angular/router";

import { canAccessMembersTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { safeProvider } from "@bitwarden/ui-common";

import { FreeBitwardenFamiliesComponent } from "../../../billing/members/free-bitwarden-families.component";
import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { canAccessSponsoredFamilies } from "./../../../billing/guards/can-access-sponsored-families.guard";
import { MembersComponent } from "./members.component";
import { UserStatusPipe } from "./pipes";
import { MemberExportService } from "./services";

export const membersRoutes: Routes = [
  {
    path: "",
    component: MembersComponent,
    canActivate: [organizationPermissionsGuard(canAccessMembersTab)],
    providers: [
      safeProvider({ provide: MemberExportService, useAngularDecorators: true }),
      safeProvider({ provide: UserStatusPipe, useAngularDecorators: true }),
    ],
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
