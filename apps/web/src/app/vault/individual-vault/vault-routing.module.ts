import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  vaultFilterLegacyRedirectGuard,
  vaultFilterRestoreGuard,
  type VaultScopeRouteData,
} from "@bitwarden/vault";

import { RouteDataProperties } from "../../core";

import { VaultNextComponent } from "./vault-next.component";
import { VaultComponent } from "./vault.component";

const routes: Routes = [
  ...featureFlaggedRoute({
    defaultComponent: VaultComponent,
    flaggedComponent: VaultNextComponent,
    featureFlag: FeatureFlag.VFO1Foundation,
    routeOptions: {
      path: "",
      data: { titleId: "vaults", vaultFilterScope: true } satisfies RouteDataProperties &
        VaultScopeRouteData,
      // Order matters: the legacy rewrite runs first, so a pre-namespace URL's own filters win
      // over the remembered ones.
      canActivate: [vaultFilterLegacyRedirectGuard, vaultFilterRestoreGuard],
    },
  }),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
