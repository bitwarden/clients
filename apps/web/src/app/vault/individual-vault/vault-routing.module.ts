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
      data: { titleId: "vaults" } satisfies RouteDataProperties,
    },
    // Filter memory and the legacy param rewrite only mean anything to the VFO1 vault, so they hang
    // off the flagged route. That keeps the pre-VFO1 vault from recording filters it can't read
    // back, and saves `vaultFilterRestoreGuard` from re-checking the flag itself.
    flaggedRouteOptions: {
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
