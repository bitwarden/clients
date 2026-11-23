import { Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { canAccessMembersTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { safeProvider } from "@bitwarden/ui-common";

import { FreeBitwardenFamiliesComponent } from "../../../billing/members/free-bitwarden-families.component";
import { RouteDataProperties } from "../../../core";
import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { canAccessSponsoredFamilies } from "./../../../billing/guards/can-access-sponsored-families.guard";
import {
  membersFilterRestoreGuard,
  membersFilterRunGuards,
} from "./members-v2/members-filter-restore.guard";
import {
  MEMBERS_FILTER_SCOPE,
  MembersFilterScopeRouteData,
} from "./members-v2/members-filter-scope";
import { MembersV2Component } from "./members-v2/members-v2.component";
import { MembersComponent } from "./members.component";
import { UserStatusPipe } from "./pipes";
import { MemberExportService } from "./services";

const membersRouteProviders = [
  safeProvider({ provide: MemberExportService, useAngularDecorators: true }),
  safeProvider({ provide: UserStatusPipe, useAngularDecorators: true }),
];

export const membersRoutes: Routes = [
  ...featureFlaggedRoute({
    defaultComponent: MembersComponent,
    flaggedComponent: MembersV2Component,
    featureFlag: FeatureFlag.MembersTableV2,
    routeOptions: {
      path: "",
      canActivate: [organizationPermissionsGuard(canAccessMembersTab)],
      providers: membersRouteProviders,
      data: {
        titleId: "members",
      },
    },
    // Only the v2 table mirrors its state to the URL, so only it remembers and restores it.
    flaggedRouteOptions: {
      path: "",
      canActivate: [organizationPermissionsGuard(canAccessMembersTab), membersFilterRestoreGuard],
      runGuardsAndResolvers: membersFilterRunGuards,
      providers: membersRouteProviders,
      data: {
        titleId: "members",
        [MEMBERS_FILTER_SCOPE]: true,
      } satisfies RouteDataProperties & MembersFilterScopeRouteData,
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
