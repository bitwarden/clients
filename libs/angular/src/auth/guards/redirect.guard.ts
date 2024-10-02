import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { KeyService } from "@bitwarden/key-management";

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
 *
 * TODO: This should return Observable<boolean | UrlTree> once we can get rid of all the promises
 */
export function redirectGuard(overrides: Partial<RedirectRoutes> = {}): CanActivateFn {
  const routes = { ...defaultRoutes, ...overrides };
  return async (route) => {
    const authService = inject(AuthService);
    const keyService = inject(KeyService);
    const deviceTrustService = inject(DeviceTrustServiceAbstraction);
    const logService = inject(LogService);
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
    const tdeEnabled = await firstValueFrom(deviceTrustService.supportsDeviceTrust$);
    const everHadUserKey = await firstValueFrom(keyService.everHadUserKey$);
    if (authStatus === AuthenticationStatus.Locked && tdeEnabled && !everHadUserKey) {
      logService.info(
        "Sending user to TDE decryption options. AuthStatus is %s. TDE support is %s. Ever had user key is %s.",
        AuthenticationStatus[authStatus],
        tdeEnabled,
        everHadUserKey,
      );
      return router.createUrlTree([routes.notDecrypted], { queryParams: route.queryParams });
    }

    if (authStatus === AuthenticationStatus.Locked) {
      return router.createUrlTree([routes.locked], { queryParams: route.queryParams });
    }

    return router.createUrlTree(["/"]);
  };
}
