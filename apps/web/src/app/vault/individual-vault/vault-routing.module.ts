import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { vaultFilterLegacyRedirectGuard, vaultScopeGuard } from "@bitwarden/vault";

import { VaultNextComponent } from "./vault-next.component";
import { VaultComponent } from "./vault.component";

const routes: Routes = [
  ...featureFlaggedRoute({
    defaultComponent: VaultComponent,
    flaggedComponent: VaultNextComponent,
    featureFlag: FeatureFlag.VFO1Foundation,
    routeOptions: {
      path: "",
      canActivate: [vaultFilterLegacyRedirectGuard],
      data: { titleId: "vaults" },
    },
  }),
  {
    path: ":vaultId",
    component: VaultNextComponent,
    canActivate: [
      canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
      vaultScopeGuard,
    ],
    data: { titleId: "vaults" },
  },
  // The shared folder a vault has been drilled into. Drilling deeper replaces the segment rather
  // than nesting under it: a folder's route names the vault it lives in, not the path taken to it.
  {
    path: ":vaultId/:collectionId",
    component: VaultNextComponent,
    canActivate: [
      canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
      vaultScopeGuard,
    ],
    data: { titleId: "vaults" },
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
