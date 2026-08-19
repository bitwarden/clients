import { ActivatedRouteSnapshot, Params, RouterStateSnapshot } from "@angular/router";

import { OrganizationId } from "@bitwarden/common/types/guid";
import { isGuid } from "@bitwarden/guid";

import {
  MY_VAULT,
  VAULT_FILTER_KEYS,
  VAULT_FILTER_NAMESPACE,
} from "../components/vault-items-table/vault-items-table.component";

/** The scope for the top-level vault route, which shows every vault's items. */
export const ALL_ITEMS_SCOPE = "all";

/**
 * The scope for the individual vault. Shares the Vault chip's sentinel so the individual vault is
 * spelled the same way whether it's selected by route or by filter.
 */
export const MY_VAULT_SCOPE = MY_VAULT;

/**
 * A vault the side nav can select, and the key its filters are remembered under: the aggregate
 * views, plus one scope per organization.
 *
 * Organizations are identified by id, so the type is open-ended by necessity — but only values that
 * pass {@link isVaultScope} inhabit it, which keeps an arbitrary string out.
 */
export type VaultScope = typeof ALL_ITEMS_SCOPE | typeof MY_VAULT_SCOPE | OrganizationId;

/** Whether a string names a vault the filter memory can key on. */
export function isVaultScope(value: string): value is VaultScope {
  return value === ALL_ITEMS_SCOPE || value === MY_VAULT_SCOPE || isGuid(value);
}

/** {@link value} as a scope, or `undefined` when it names no vault. */
export function toVaultScope(value: string): VaultScope | undefined {
  return isVaultScope(value) ? value : undefined;
}

/** The route `data` key a vault route sets to opt its filters into the memory. */
export const VAULT_FILTER_SCOPE = "vaultFilterScope";

/**
 * The route param naming the vault a route shows. Absent on the all-items route, which shows them
 * all.
 */
export const VAULT_SCOPE_PARAM = "vaultId";

/** The `data` a route declares to opt into filter memory. */
export type VaultScopeRouteData = { [VAULT_FILTER_SCOPE]: true };

/**
 * Query params that are namespaced to the vault filters but deliberately not remembered:
 *
 * - `search` is free text the user typed and is not expected to be restored.
 */
const EXCLUDED_PARAMS: ReadonlySet<string> = new Set([
  `${VAULT_FILTER_NAMESPACE}.${VAULT_FILTER_KEYS.search}`,
]);

/**
 * The filter-memory scope for the activated route, or `null` when no route on it opted in.
 *
 * Resolved from the route config rather than the URL's shape: a route declares
 * {@link VAULT_FILTER_SCOPE} in its `data` and names its vault with {@link VAULT_SCOPE_PARAM}, so
 * neither the path a client mounts the vault under nor the position of the vault's segment within it
 * matters here.
 */
export function vaultScopeOf(state: RouterStateSnapshot): VaultScope | null {
  const route = scopedRoute(state.root);
  if (route == null) {
    return null;
  }

  const vaultId = route.paramMap.get(VAULT_SCOPE_PARAM);
  if (vaultId == null) {
    return ALL_ITEMS_SCOPE;
  }

  return toVaultScope(vaultId) ?? null;
}

/**
 * The shallowest activated route opting into filter memory, searching down the primary outlet.
 * Shallowest rather than deepest because that's the route the scope's param is declared on — a
 * child route showing an item within the vault shares its parent's scope.
 */
function scopedRoute(root: ActivatedRouteSnapshot): ActivatedRouteSnapshot | null {
  for (let route: ActivatedRouteSnapshot | null = root; route != null; route = route.firstChild) {
    if (route.data[VAULT_FILTER_SCOPE] === true) {
      return route;
    }
  }
  return null;
}

/**
 * The subset of a vault URL's query params worth carrying forward to the next visit: everything
 * under the filter namespace except {@link EXCLUDED_PARAMS}.
 *
 */
export function rememberableParams(params: Params): Params {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([key]) => key.startsWith(`${VAULT_FILTER_NAMESPACE}.`) && !EXCLUDED_PARAMS.has(key),
    ),
  );
}

/**
 * Whether a URL already states its own filters, and so shouldn't have remembered ones applied over
 * it.
 *
 * Broader than {@link rememberableParams}: a link carrying only `vault.search` states a filter this
 * memory deliberately doesn't record, and layering a remembered type or folder onto it would show
 * something other than what the link asked for.
 */
export function hasFilterParams(params: Params): boolean {
  return Object.keys(params).some((key) => key.startsWith(`${VAULT_FILTER_NAMESPACE}.`));
}
