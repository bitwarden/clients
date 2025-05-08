import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { Utils } from "@bitwarden/common/platform/misc/utils";

import { RouterService } from "../../../core/router.service";

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
    } else if (isValidUrl(transientPreviousUrl) && transientPreviousUrl !== undefined) {
      await routerService.persistLoginRedirectUrl(transientPreviousUrl);
    }
    return true;
  };

  /**
   * Check if the URL is valid for deep linking. A valid url is described as not including
   * "lock" or "login-initiated". Valid urls are only urls that are not part of login or
   * decryption flows.
   * We ignore the "lock" url because standard SSO flows will send users to the lock component.
   * We ignore "login-initiated" because TDE users decrypting with master passwords are
   * sent to the lock component.
   * @param url The URL to check.
   * @returns True if the URL is valid, false otherwise.
   */
  function isValidUrl(url: string | null | undefined): boolean {
    if (url === undefined) {
      return false;
    }

    if (Utils.isNullOrEmpty(url)) {
      return false;
    }
    const lowerCaseUrl: string = url.toLocaleLowerCase();

    // Login --> Deep link to vault item --> deepLinkGuard catches & saves --> user lands on login page
    // User logs in via SSO with TDE on untrusted device --> user lands on login-initiated page
    // User has MP so attempts to unlock via MP --> user goes to lock page
    // Lock page is guarded by deepLinkGuard. Previously, it would save the login-initiated url
    // as a deep link which would overwrite the vault item deep link.

    if (lowerCaseUrl.includes("login-initiated") || lowerCaseUrl.includes("lock")) {
      return false;
    }

    return true;
  }
}
