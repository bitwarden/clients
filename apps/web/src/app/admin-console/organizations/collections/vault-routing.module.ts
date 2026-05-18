import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { canAccessVaultTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { VaultV2Component } from "./vault-v2.component";
import { VaultComponent } from "./vault.component";

const routes: Routes = [
  ...featureFlaggedRoute({
    defaultComponent: VaultComponent,
    flaggedComponent: VaultV2Component,
    featureFlag: FeatureFlag.PM36859RefactorOrgCollectionsVaultComponent,
    routeOptions: {
      data: { titleId: "vaults" },
      path: "",
      canActivate: [organizationPermissionsGuard(canAccessVaultTab)],
    },
  }),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
