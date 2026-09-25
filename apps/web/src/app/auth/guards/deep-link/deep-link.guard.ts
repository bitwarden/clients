import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { RouterService } from "../../../core/router.service";

/**
 * Guard to persist and apply deep links to handle users who are not unlocked.
 *
 * Attach it only to routes a user can deep link to. On any other route (e.g. a login or
 * unlock step), the guard would overwrite the persisted deep link with that route's URL.
 *
 * @returns returns true. If user is not Unlocked will store URL to state for redirect once
 * user is unlocked/Authenticated.
 */
export function deepLinkGuard(): CanActivateFn {
  return async (route, routerState) => {
    // Inject Services
    const authService = inject(AuthService);
    const router = inject(Router);
    const routerService = inject(RouterService);

    // Fetch State
    const currentUrl = routerState.url;
    const authStatus = await authService.getAuthStatus();

    // Evaluate State
    /** before anything else, check if the user is already unlocked. */
    if (authStatus === AuthenticationStatus.Unlocked) {
      const persistedPreLoginUrl: string | undefined =
        await routerService.getAndClearLoginRedirectUrl();
      if (persistedPreLoginUrl === undefined) {
        // Url us undefined, so there is nothing to navigate to.
        return true;
      }
      // Check if the url is empty or null
      if (!Utils.isNullOrEmpty(persistedPreLoginUrl)) {
        // const urlTree: string | UrlTree = persistedPreLoginUrl;
        return router.navigateByUrl(persistedPreLoginUrl);
      }
      return true;
    }
    // At this point the user is either `locked` or `loggedOut`, it doesn't matter.
    await routerService.persistLoginRedirectUrl(currentUrl);
    return true;
  };
}
