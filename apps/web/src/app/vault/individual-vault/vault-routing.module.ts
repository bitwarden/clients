import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { vaultFilterLegacyRedirectGuard } from "@bitwarden/vault";

import { VaultNextComponent } from "./vault-next.component";
import { VaultComponent } from "./vault.component";

const routes: Routes = [
  ...featureFlaggedRoute({
    defaultComponent: VaultComponent,
    flaggedComponent: VaultNextComponent,
    featureFlag: FeatureFlag.VFO1Foundation,
    routeOptions: {
      path: "",
      data: { titleId: "vaults" },
      canActivate: [vaultFilterLegacyRedirectGuard],
    },
  }),
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class VaultRoutingModule {}
