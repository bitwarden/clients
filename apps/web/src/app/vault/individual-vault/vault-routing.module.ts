import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  SHARED_FOLDERS_ROUTE,
  vaultFilterLegacyRedirectGuard,
  vaultScopeGuard,
} from "@bitwarden/vault";

import { organizationVaultGuard } from "./shared-folders/organization-vault.guard";
import { SharedFoldersComponent } from "./shared-folders/shared-folders.component";
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
  // An organization vault's shared folders. Declared above `:vaultId/:collectionId` and must stay
  // there: the router matches in declaration order rather than preferring a static segment over a
  // parameter, so below it this path would be read as a collection named "shared-folders" and
  // `vaultScopeGuard` would redirect away before this route was ever tried. The reverse collision
  // can't happen — collection ids are guids.
  {
    path: `:vaultId/${SHARED_FOLDERS_ROUTE}`,
    component: SharedFoldersComponent,
    canActivate: [
      canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
      organizationVaultGuard,
      vaultScopeGuard,
    ],
    data: { titleId: "sharedFolders" },
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
