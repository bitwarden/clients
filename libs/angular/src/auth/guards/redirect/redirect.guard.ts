import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

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
 * Redirects the user to the appropriate route based on their `AuthenticationStatus`.
 * This guard should be applied to the root route.
 *
 * TODO: This should return Observable<boolean | UrlTree> once we can get rid of all the promises
 */
export function redirectGuard(overrides: Partial<RedirectRoutes> = {}): CanActivateFn {
  const routes = { ...defaultRoutes, ...overrides };

  return async (route) => {
    const authService = inject(AuthService);
    const deviceTrustService = inject(DeviceTrustServiceAbstraction);
    const vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
    const accountService = inject(AccountService);
    const logService = inject(LogService);
    const router = inject(Router);

    const authStatus = await authService.getAuthStatus();

    // Logged Out
    if (authStatus === AuthenticationStatus.LoggedOut) {
      return router.createUrlTree([routes.loggedOut], { queryParams: route.queryParams });
    }

    // Unlocked
    if (authStatus === AuthenticationStatus.Unlocked) {
      return router.createUrlTree([routes.loggedIn], { queryParams: route.queryParams });
    }

    // Locked: TDE Locked State
    //  - If user meets all 3 of the following conditions:
    //    1. Auth status is Locked
    //    2. TDE is enabled
    //    3. User has no available unlock methods (master password, PIN, or biometrics)
    const tdeEnabled = await firstValueFrom(deviceTrustService.supportsDeviceTrust$);
    const userId = await firstValueFrom(accountService.activeAccount$.pipe(getUserId));
    const canLockVault = await vaultTimeoutSettingsService.canLock(userId);
    if (authStatus === AuthenticationStatus.Locked && tdeEnabled && !canLockVault) {
      logService.info(
        "Sending user to TDE decryption options. AuthStatus is %s. TDE support is %s. Can lock is %s.",
        AuthenticationStatus[authStatus],
        tdeEnabled,
        canLockVault,
      );
      return router.createUrlTree([routes.notDecrypted], { queryParams: route.queryParams });
    }

    // Locked: Standard Locked State
    if (authStatus === AuthenticationStatus.Locked) {
      return router.createUrlTree([routes.locked], { queryParams: route.queryParams });
    }

    return router.createUrlTree(["/"]);
  };
}
