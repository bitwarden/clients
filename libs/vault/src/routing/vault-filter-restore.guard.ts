import { inject } from "@angular/core";
import { CanActivateFn, Router, createUrlTreeFromSnapshot } from "@angular/router";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { VaultFilterMemoryService } from "./vault-filter-memory.service";
import { hasFilterParams, vaultScopeOf } from "./vault-scope";

/**
 * Restores the filters a vault was last viewed with by redirecting a filter-less vault URL to the
 * same route carrying them.
 *
 * Restoring happens here rather than at each link so that every way into the vault behaves the
 * same. Most arrivals aren't a side nav click: the post-login and post-unlock landing comes from
 * `redirectGuard`, the product switcher and the org permissions guard navigate to `/vault`
 * directly, and a bookmark skips the app's chrome entirely. A link that carried the params itself
 * would restore for one of those and not the rest.
 *
 * Register it after `vaultFilterLegacyRedirectGuard`, whose rewrite produces namespaced params and
 * so takes precedence over the memory on its own.
 *
 * A user clears the memory by clearing the filters: the bare URL that leaves behind is recorded
 * like any other, after which there is nothing here to restore.
 */
export const vaultFilterRestoreGuard: CanActivateFn = async (route, state) => {
  const router = inject(Router);
  const configService = inject(ConfigService);
  const filterMemory = inject(VaultFilterMemoryService);

  // Read before the first await, while this navigation is still the current one. Back and forward
  // have to land on the URL held in the history stack — rewriting it here would put the entry the
  // user just left back in front of them.
  if (router.getCurrentNavigation()?.trigger === "popstate") {
    return true;
  }

  const scope = vaultScopeOf(state);
  if (scope == null) {
    return true;
  }

  // The URL states its own filters — including none, when they were just cleared.
  if (hasFilterParams(state.root.queryParams)) {
    return true;
  }

  const remembered = filterMemory.paramsFor(scope);
  if (Object.keys(remembered).length === 0) {
    return true;
  }

  // Only restore when VFO flag is enavled
  if (!(await configService.getFeatureFlag(FeatureFlag.VFO1Foundation))) {
    return true;
  }

  // Merged over the incoming params so a deep link's own keys — `cipherId`, `action` — survive.
  return createUrlTreeFromSnapshot(route, [], { ...state.root.queryParams, ...remembered });
};
