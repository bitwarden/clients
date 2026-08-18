import { Params, PRIMARY_OUTLET, UrlTree } from "@angular/router";

import {
  VAULT_FILTER_KEYS,
  VAULT_FILTER_NAMESPACE,
} from "../components/vault-items-table/vault-items-table.component";

/** The scope key for the top-level vault route, which shows every vault's items. */
export const ALL_ITEMS_SCOPE = "all";

/** The first path segment of every vault route. */
const VAULT_SEGMENT = "vault";

/**
 * Query params that are namespaced to the vault filters but deliberately not remembered:
 *
 * - `search` is free text the user typed and is not expected to be restored.
 */
const EXCLUDED_PARAMS: ReadonlySet<string> = new Set([
  `${VAULT_FILTER_NAMESPACE}.${VAULT_FILTER_KEYS.search}`,
]);

/**
 * The filter-memory scope key for a vault URL, or `null` when the URL isn't a vault page.
 *
 * The key is the vault route's second path segment, so each vault the side nav can select keeps
 * its own remembered filters. The top-level route has no second segment and resolves to
 * {@link ALL_ITEMS_SCOPE}.
 */
export function vaultScopeKey(tree: UrlTree): string | null {
  const segments = tree.root.children[PRIMARY_OUTLET]?.segments.map((s) => s.path) ?? [];
  if (segments[0] !== VAULT_SEGMENT) {
    return null;
  }
  return segments[1] ?? ALL_ITEMS_SCOPE;
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
