import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";

import { ImportUpgradeNavigationService } from "../settings/import/import-upgrade-navigation.service";

/**
 * Blocks the extension's own legacy import route once the new import experience is enabled — that
 * flow always opens the new picker in its own extension tab instead (the picker doesn't fit inside
 * the popup). This is a safety net for a stale link or direct navigation; the two known entry
 * points into this route already check the flag themselves before navigating here.
 *
 * Redirects to `/tabs/vault` rather than just returning `false`: a plain cancellation never fires
 * `NavigationEnd`, so `PopupRouterCacheService` (which only advances its cache on `NavigationEnd`)
 * would keep replaying `/import` as the popup's initial route on every subsequent open, spawning a
 * new tab each time with no way back into the popup.
 *
 * Angular runs every canActivate guard on a route concurrently, not sequentially — so this guard
 * cannot rely on `authGuard` (earlier in the same route's canActivate array) having already
 * blocked the navigation before this one's side effect runs. Without the auth check below, a
 * locked or logged-out popup replaying a cached /import route would still open the extension tab
 * here, on top of authGuard separately sending the popup to /lock.
 */
export const importUpgradeRedirectGuard: CanActivateFn = async () => {
  // All injections must happen synchronously, before any `await` — `inject()` only works within
  // the guard's initial injection context.
  const configService = inject(ConfigService);
  const importUpgradeNavigationService = inject(ImportUpgradeNavigationService);
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!(await configService.getFeatureFlag(FeatureFlag.ImportUpgrade))) {
    return true;
  }

  if ((await authService.getAuthStatus()) !== AuthenticationStatus.Unlocked) {
    return true;
  }

  await importUpgradeNavigationService.openImportSourceSelectTab();
  return router.parseUrl("/tabs/vault");
};
