import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import {
  isPersonalOnly,
  parseVaultScope,
  VAULT_BASE_ROUTE,
  VaultNavItemType,
  VaultNavService,
  vaultScopeCommands,
  VaultScopeType,
} from "@bitwarden/vault";

import { VaultPopupListTableFiltersService } from "../services/vault-popup-list-table-filters.service";

/**
 * Sends the unscoped vault route to the vault the active user last selected, so landing on the
 * vault after an account switch or popup reopen puts them back where they left off. The selection
 * is cleared when the user locks or logs out, so it isn't restored after an unlock. Choosing All
 * items records that choice first (see `VaultSwitcherComponent`), so it isn't sent back.
 *
 * A stored vault the account no longer offers is dropped rather than redirected to: the scoped
 * route would send it straight back here.
 */
export const restoreVaultScopeGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const accountService = inject(AccountService);
  const vaultNavService = inject(VaultNavService);
  const basePath = inject(VAULT_BASE_ROUTE);
  const listFiltersService = inject(VaultPopupListTableFiltersService);

  const scope = parseVaultScope(await listFiltersService.storedVaultScopeId());
  if (scope == null || scope.type === VaultScopeType.AllItems) {
    return true;
  }

  const nav = await firstValueFrom(
    accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => vaultNavService.viewModel$(userId)),
    ),
  );

  const offered =
    scope.type === VaultScopeType.MyVault
      ? !isPersonalOnly(nav)
      : scope.type === VaultScopeType.Organization &&
        nav.vaults.some(
          ({ id, type }) => type !== VaultNavItemType.Personal && id === scope.organizationId,
        );
  if (!offered) {
    await listFiltersService.setCachedVaultScopeId(null);
    return true;
  }

  return router.createUrlTree(vaultScopeCommands(scope, basePath));
};
