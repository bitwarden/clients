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
    // The side nav's vault scopes: `my-vault` and an organization id. "All items" is the unscoped
    // route above, so every existing vault deep link keeps hitting the component it does today.
    path: ":vaultId",
    component: VaultNextComponent,
    canActivate: [
      // Scoped vaults only exist in the new vault, so send them to the legacy one when it is off.
      // No toast — a redirect is the whole story here, not an access denial.
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
