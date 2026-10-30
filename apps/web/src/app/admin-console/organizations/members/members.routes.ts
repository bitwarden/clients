import { Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { canAccessMembersTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { safeProvider } from "@bitwarden/ui-common";

import { FreeBitwardenFamiliesComponent } from "../../../billing/members/free-bitwarden-families.component";
import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { canAccessSponsoredFamilies } from "./../../../billing/guards/can-access-sponsored-families.guard";
import { MembersV2Component } from "./members-v2/members-v2.component";
import { MembersComponent } from "./members.component";
import { UserStatusPipe } from "./pipes";
import { MemberExportService } from "./services";

export const membersRoutes: Routes = [
  ...featureFlaggedRoute({
    defaultComponent: MembersComponent,
    flaggedComponent: MembersV2Component,
    featureFlag: FeatureFlag.MembersTableV2,
    routeOptions: {
      path: "",
      canActivate: [organizationPermissionsGuard(canAccessMembersTab)],
      providers: [
        safeProvider({ provide: MemberExportService, useAngularDecorators: true }),
        safeProvider({ provide: UserStatusPipe, useAngularDecorators: true }),
      ],
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
