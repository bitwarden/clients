import { ActivatedRouteSnapshot, Params, RouterStateSnapshot } from "@angular/router";

import {
  VAULT_FILTER_KEYS,
  VAULT_FILTER_NAMESPACE,
} from "../components/vault-items-table/vault-items-table.component";
import { parseVaultScope, VaultScope } from "../models/vault-scope";

import { scopedCollectionSegment } from "./scoped-collection";

/** The route `data` key a vault route sets to opt its filters into the memory. */
export const VAULT_FILTER_SCOPE = "vaultFilterScope";

/**
 * The route param naming the vault a route shows. Absent on the all-items route, which shows them
 * all.
 */
export const VAULT_SCOPE_PARAM = "vaultId";

export type VaultScopeRouteData = { [VAULT_FILTER_SCOPE]: true };

/**
 * The `bit-table-v2` param keys carrying sort state. Mirrored rather than imported because the
 * table keeps them module-private, the same way the vault table mirrors its search key.
 */
const SORT_KEYS = ["sort", "direction"] as const;

/**
 * The keys worth carrying forward to the next visit. An allowlist rather than a denylist, so a
 * param added under the namespace later isn't persisted by accident.
 *
 * Left out deliberately:
 *
 * - `search` is free text the user typed, not a filter they'd expect to come back.
 * - pagination (`page`, `pageSize`) is a position in a list, not a filter.
 */
const REMEMBERED_KEYS: ReadonlySet<string> = new Set(
  [
    VAULT_FILTER_KEYS.type,
    VAULT_FILTER_KEYS.favorites,
    VAULT_FILTER_KEYS.vault,
    VAULT_FILTER_KEYS.sharedFolder,
    VAULT_FILTER_KEYS.folder,
    ...SORT_KEYS,
  ].map((key) => `${VAULT_FILTER_NAMESPACE}.${key}`),
);

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

  return parseVaultScope(
    route.paramMap.get(VAULT_SCOPE_PARAM),
    scopedCollectionSegment(route.paramMap, route.data),
  );
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

/** The subset of a vault URL's query params worth keeping — see {@link REMEMBERED_KEYS}. */
export function rememberableParams(params: Params): Params {
  return Object.fromEntries(Object.entries(params).filter(([key]) => REMEMBERED_KEYS.has(key)));
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
