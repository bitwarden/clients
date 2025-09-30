import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { canAccessVaultTab } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";

import { organizationPermissionsGuard } from "../guards/org-permissions.guard";

import { VaultComponent } from "./deprecated_vault.component";
import { vNextVaultComponent } from "./vault.component";

const routes: Routes = [
  ...featureFlaggedRoute({
    defaultComponent: VaultComponent,
    flaggedComponent: vNextVaultComponent,
    featureFlag: FeatureFlag.CollectionVaultRefactor,
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
