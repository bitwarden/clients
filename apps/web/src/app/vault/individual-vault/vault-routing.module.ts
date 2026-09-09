import { NgModule } from "@angular/core";
import { RouterModule, Routes } from "@angular/router";

import { canAccessFeature } from "@bitwarden/angular/platform/guard/feature-flag.guard";
import { featureFlaggedRoute } from "@bitwarden/angular/platform/utils/feature-flagged-route";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import {
  MY_ITEMS_ROUTE,
  MY_ITEMS_ROUTE_DATA,
  organizationVaultGuard,
  SHARED_FOLDERS_ROUTE,
  vaultFilterLegacyRedirectGuard,
  vaultScopeGuard,
} from "@bitwarden/vault";

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
  // An organization's "My items" collection. A page of the vault rather than one of its shared
  // folders, so it sits alongside the list rather than under it — see `MY_ITEMS_ROUTE`.
  {
    path: `:vaultId/${MY_ITEMS_ROUTE}`,
    component: VaultNextComponent,
    canActivate: [
      canAccessFeature(FeatureFlag.VFO1Foundation, true, "/vault", false),
      vaultScopeGuard,
    ],
    data: { ...MY_ITEMS_ROUTE_DATA, titleId: "vaults" },
  },
  // An organization vault's shared folders.
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
  // The shared folder a vault has been drilled into. Drilling deeper replaces the `:collectionId`
  // segment rather than adding to it — see `vaultScopeCommands`.
  {
    path: `:vaultId/${SHARED_FOLDERS_ROUTE}/:collectionId`,
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
