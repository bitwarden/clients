import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";

export interface RedirectRoutes {
  loggedIn: string;
  loggedOut: string;
  locked: string;
  notDecrypted: string;
}

const defaultRoutes: RedirectRoutes = {
  loggedIn: "/vault",
  loggedOut: "/login",
  locked: "/lock",
  notDecrypted: "/login-initiated",
};

/**
 * Guard that consolidates all redirection logic, should be applied to root route.
 */
export function redirectGuard(overrides: Partial<RedirectRoutes> = {}): CanActivateFn {
  const routes = { ...defaultRoutes, ...overrides };
  return async (route) => {
    const authService = inject(AuthService);
    const cryptoService = inject(CryptoService);
    const deviceTrustCryptoService = inject(DeviceTrustCryptoServiceAbstraction);
    const router = inject(Router);

    const authStatus = await authService.getAuthStatus();

    if (authStatus === AuthenticationStatus.LoggedOut) {
      return router.createUrlTree([routes.loggedOut], { queryParams: route.queryParams });
    }

    if (authStatus === AuthenticationStatus.Unlocked) {
      return router.createUrlTree([routes.loggedIn], { queryParams: route.queryParams });
    }

    // If locked, TDE is enabled, and the user hasn't decrypted yet, then redirect to the
    // login decryption options component.
    const tdeEnabled = await deviceTrustCryptoService.supportsDeviceTrust();
    const everHadUserKey = await cryptoService.getEverHadUserKey();
    if (authStatus === AuthenticationStatus.Locked && tdeEnabled && !everHadUserKey) {
      return router.createUrlTree([routes.notDecrypted], { queryParams: route.queryParams });
    }

    if (authStatus === AuthenticationStatus.Locked) {
      return router.createUrlTree([routes.locked], { queryParams: route.queryParams });
    }

    return router.createUrlTree(["/"]);
  };
}
