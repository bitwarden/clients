import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { VaultNavItemType } from "../models/vault-nav-view-model";
import { isPersonalOnly, parseVaultScope, VaultScopeType } from "../models/vault-scope";
import { VaultNavService } from "../services/vault-nav.service";

/**
 * Guards the `:vaultId` vault routes, redirecting to the unscoped vault when the segment names no
 * vault the side nav offers — a typo, a bookmark to an organization the user has left, or
 * `my-vault` on an account whose lone entry already points at the unscoped route. Without it those
 * URLs render an empty vault, or the right rows under a nav with nothing highlighted.
 *
 * The nav view model, rather than the organization list, decides membership: the two disagree on
 * provider organizations, and the guard should admit exactly what the nav can highlight.
 */
export const vaultScopeGuard: CanActivateFn = async (route) => {
  const router = inject(Router);
  const vaultNavService = inject(VaultNavService);

  const allItems = () => router.createUrlTree(["/vault"]);

  const scope = parseVaultScope(route.paramMap.get("vaultId"));
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

  return isMember ? true : allItems();
};
