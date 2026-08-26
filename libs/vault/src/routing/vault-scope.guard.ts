import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { VaultNavItemType } from "../models/vault-nav-view-model";
import {
  defaultUserCollectionId,
  isPersonalOnly,
  MY_ITEMS_ROUTE,
  parseVaultScope,
  VaultScopeType,
} from "../models/vault-scope";
import { VaultNavService } from "../services/vault-nav.service";

/**
 * Guards the `:vaultId` vault routes, redirecting to the unscoped vault when the segment names no
 * vault the side nav offers — a typo, a bookmark to an organization the user has left, or
 * `my-vault` on an account whose lone entry already points at the unscoped route. Without it those
 * URLs render an empty vault, or the right rows under a nav with nothing highlighted.
 *
 * The nav view model, rather than the organization list, decides membership: the two disagree on
 * provider organizations, and the guard should admit exactly what the nav can highlight.
 *
 * A `:collectionId` segment drilling the vault into a shared folder is admitted with its vault —
 * see {@link parseVaultScope} for the pairings that name no destination. Whether the collection
 * itself is one the user can reach is left to the page, which resolves it against the collections
 * it already loads. The exception is the `my-items` sentinel, which names a collection only for an
 * organization the nav offers one for, and the nav is already in hand here.
 */
export const vaultScopeGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const vaultNavService = inject(VaultNavService);

  const allItems = () => router.createUrlTree(["/vault"]);

  const scope = parseVaultScope(route.paramMap.get("vaultId"), route.paramMap.get("collectionId"));
  if (scope == null) {
    return allItems();
  }

  if (scope.type !== VaultScopeType.MyVault && scope.type !== VaultScopeType.Organization) {
    return true;
  }

  const nav = await firstValueFrom(vaultNavService.viewModel$);

  if (scope.type === VaultScopeType.MyVault) {
    return isPersonalOnly(nav) ? allItems() : true;
  }

  const isMember = nav.vaults.some(
    ({ id, type }) => type !== VaultNavItemType.Personal && id === scope.organizationId,
  );

  if (!isMember) {
    return allItems();
  }

  // "My items" names a destination only for an organization that has such a collection — one under
  // the data ownership policy. Elsewhere the segment names nothing, the way a typo would.
  if (
    scope.collectionId === MY_ITEMS_ROUTE &&
    defaultUserCollectionId(scope.organizationId, nav) == null
  ) {
    return allItems();
  }

  return true;
};
