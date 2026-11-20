import { InjectionToken, inject } from "@angular/core";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

/**
 * Launches the Keeper SSO flow and, where the client supports it, captures the
 * resulting token automatically from the callback page.
 *
 * Currently only the browser extension can intercept the callback tab; other
 * clients open the URL externally and rely on the user pasting the token back
 * via the auth dialog.
 */
export interface KeeperSsoTabMonitor {
  /**
   * Opens `ssoUrl` and resolves with the SSO token once the callback page
   * matching `isSsoCallbackUrl` has loaded.
   *
   * Implementations that cannot intercept the callback (web, desktop, CLI)
   * should still open the URL, then reject so the caller can fall back to a
   * manual paste flow.
   *
   * @param ssoUrl IdP URL to navigate to.
   * @returns The token extracted from the callback page.
   */
  launchAndWaitForToken(ssoUrl: string): Promise<string>;

  /**
   * Aborts an in-flight `launchAndWaitForToken` call: detaches listeners and
   * closes any tab the monitor opened. Safe to call when nothing is in flight.
   */
  cancel(): void;
}

/**
 * Keeper accepts the assertion at two addresses, depending on identity provider setup:
 *
 *   Okta catalog app:  https://keepersecurity.com/api/rest/sso/saml/1463918128005127/saml/sso
 *   Everything else:   https://keepersecurity.com/api/rest/sso/saml/sso/1463918128005127
 */
export function isSsoCallbackUrl(candidate: string, ssoUrl: string): boolean {
  let url: URL;
  let launched: URL;
  try {
    url = new URL(candidate);
    launched = new URL(ssoUrl);
  } catch {
    return false;
  }

  if (url.origin !== launched.origin) {
    return false;
  }

  const path = url.pathname;
  if (!path.startsWith("/api/rest/sso/saml/")) {
    return false;
  }

  return path.includes("/saml/sso/") || path.endsWith("/saml/sso");
}

class DefaultKeeperSsoTabMonitor implements KeeperSsoTabMonitor {
  constructor(private readonly platformUtilsService: PlatformUtilsService) {}

  launchAndWaitForToken(ssoUrl: string): Promise<string> {
    this.platformUtilsService.launchUri(ssoUrl);
    return Promise.reject(new Error("SSO token auto-capture is not supported in this client"));
  }

  cancel(): void {}
}

export const KEEPER_SSO_TAB_MONITOR = new InjectionToken<KeeperSsoTabMonitor>(
  "KEEPER_SSO_TAB_MONITOR",
  {
    providedIn: "root",
    factory: () => new DefaultKeeperSsoTabMonitor(inject(PlatformUtilsService)),
  },
);
