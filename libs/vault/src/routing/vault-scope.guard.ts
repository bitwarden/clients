import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { CollectionService } from "@bitwarden/admin-console/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { OrganizationId } from "@bitwarden/common/types/guid";

import { VaultNavItemType } from "../models/vault-nav-view-model";
import {
  defaultUserCollectionId,
  isPersonalOnly,
  MY_ITEMS_ROUTE,
  parseVaultScope,
  vaultScopeCommands,
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
 * A `:collectionId` segment drilling the vault into a shared folder is admitted only when the user
 * can reach that folder — see {@link parseVaultScope} for the vault pairings that name no
 * destination at all. A folder the user's collections do not hold and one owned by another
 * organization both fall back to the organization's own vault rather than to the unscoped one:
 * membership is established by then, so the vault the URL named is still a destination even though
 * the folder within it is not.
 *
 * The active account is resolved once and both the nav view model and the collections are read for
 * that user, so an account switch mid-navigation cannot decide membership from one account's vaults
 * and the folder from another's collections.
 */
export const vaultScopeGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const vaultNavService = inject(VaultNavService);
  const accountService = inject(AccountService);
  const collectionService = inject(CollectionService);

  const allItems = () => router.createUrlTree(["/vault"]);
  const organizationVault = (organizationId: OrganizationId) =>
    router.createUrlTree(vaultScopeCommands({ type: VaultScopeType.Organization, organizationId }));

  const scope = parseVaultScope(route.paramMap.get("vaultId"), route.paramMap.get("collectionId"));
  if (scope == null) {
    return allItems();
  }

  if (scope.type !== VaultScopeType.MyVault && scope.type !== VaultScopeType.Organization) {
    return true;
  }

  const userId = await firstValueFrom(accountService.activeAccount$.pipe(getUserId));
  const nav = await firstValueFrom(vaultNavService.viewModel$(userId));

  if (scope.type === VaultScopeType.MyVault) {
    return isPersonalOnly(nav) ? allItems() : true;
  }

  const isMember = nav.vaults.some(
    ({ id, type }) => type !== VaultNavItemType.Personal && id === scope.organizationId,
  );

  if (!isMember) {
    return allItems();
  }

  const { organizationId, collectionId } = scope;

  if (collectionId == null) {
    return true;
  }

  // "My items" names a destination only for an organization that has such a collection — one under
  // the data ownership policy. Elsewhere the segment names nothing, the way a typo would.
  if (collectionId === MY_ITEMS_ROUTE) {
    return defaultUserCollectionId(organizationId, nav) == null ? allItems() : true;
  }

  // A shared folder is reachable only if the user holds it — a folder they are not assigned, one
  // that has been deleted, and one belonging to another organization are all guids that name no
  // destination for this user. The page would otherwise render an empty vault beneath a folder
  // heading it cannot resolve, so drop the drill-in and show the vault the URL did name.
  //
  // Uses encrypted collections to avoid waiting on decryption during a critical path
  const collections = await firstValueFrom(collectionService.encryptedCollections$(userId));

  const reachable = (collections ?? []).some(
    (collection) => collection.id === collectionId && collection.organizationId === organizationId,
  );

  return reachable ? true : organizationVault(organizationId);
};
