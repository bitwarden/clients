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
    if (url === undefined || url === null) {
      return false;
    }

    if (Utils.isNullOrEmpty(url)) {
      return false;
    }
    const lowerCaseUrl: string = url.toLocaleLowerCase();

    /**
     * "Login-initiated" ignored because it is used for TDE users decrypting from a new device. A TDE user
     * can opt to decrypt using their password. Decrypting with a password will send the user to the lock component,
     * which is protected by the deep link guard. We don't persist the `login-initiated` url because it is not a
     * valid deep-link. We don't want users to be sent to the login-initiated url when they are unlocked.
     * If we did navigate to the login-initiated url, the user would get caught by the TDE Guard and be sent
     * to the vault and not the intended deep link.
     *
     * "Lock" is ignored because users cannot deep-link to the lock component if they are already unlocked.
     * Users logging in with SSO will be sent to the lock component after they are authenticated with their IdP.
     * SSO users would be navigated to the "lock" component loop if we persisted the "lock" url.
     */

    if (lowerCaseUrl.includes("/login-initiated") || lowerCaseUrl.includes("/lock")) {
      return false;
    }

    return true;
  }
}
