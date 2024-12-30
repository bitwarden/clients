// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { RouterService } from "../../core/router.service";

/**
 * Guard to persist and apply deep links to handle users who are not unlocked.
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
    const transientPreviousUrl = routerService.getPreviousUrl();
    const authStatus = await authService.getAuthStatus();

    // Evaluate State
    /** before anything else, check if the user is already unlocked. */
    if (authStatus === AuthenticationStatus.Unlocked) {
      const persistedPreLoginUrl = await routerService.getAndClearLoginRedirectUrl();
      if (!Utils.isNullOrEmpty(persistedPreLoginUrl)) {
        return router.navigateByUrl(persistedPreLoginUrl);
      }
      return true;
    }
    /**
     * At this point the user is either `locked` or `loggedOut`, it doesn't matter.
     * We opt to persist the currentUrl over the transient previousUrl. This supports
     * the case where a user is locked out of their vault and they deep link from
     * the "lock" page.
     *
     * When the user is locked out of their vault the currentUrl contains "lock" so it will
     * not be persisted, the previousUrl will be persisted instead.
     */
    if (isValidUrl(currentUrl)) {
      await routerService.persistLoginRedirectUrl(currentUrl);
    } else if (isValidUrl(transientPreviousUrl)) {
      await routerService.persistLoginRedirectUrl(transientPreviousUrl);
    }
    return true;
  };

  function isValidUrl(url: string | null | undefined): boolean {
    return !Utils.isNullOrEmpty(url) && !url?.toLocaleLowerCase().includes("/lock");
  }
}
