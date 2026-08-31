import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { parseVaultScope, VaultScopeType } from "../models/vault-scope";

/**
 * Narrows the `:vaultId` routes to organization vaults, for the pages that only an organization
 * has — Shared folders being the first.
 *
 * `vaultScopeGuard` admits every vault the side nav offers, including `my-vault`, `trash`, and
 * `archive`. Those name real destinations, so it is right to let them through; they just have no
 * shared folders of their own, and without this the page would render an empty table under a
 * heading for a vault that could never fill it.
 *
 * Membership is not re-checked here — pair this with `vaultScopeGuard`, which resolves the nav to
 * decide that. This guard reads the segment only, so it settles synchronously and the two compose
 * in either order.
 */
export const organizationVaultGuard: CanActivateFn = (route) => {
  const router = inject(Router);

  const scope = parseVaultScope(route.paramMap.get("vaultId"));

  return scope?.type === VaultScopeType.Organization || router.createUrlTree(["/vault"]);
};
