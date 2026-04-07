import { inject } from "@angular/core";
import { ActivatedRouteSnapshot, CanActivateFn, Router, UrlTree } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

type UnauthRoutes = {
  homepage: () => string;
  locked: string;
};

const defaultRoutes: UnauthRoutes = {
  homepage: () => "/vault",
  locked: "/lock",
};

// TODO: PM-17195 - Investigate consolidating unauthGuard and redirectGuard into AuthStatusGuard
async function unauthGuard(
  route: ActivatedRouteSnapshot,
  routes: UnauthRoutes,
): Promise<boolean | UrlTree> {
  const accountService = inject(AccountService);
  const authService = inject(AuthService);
  const router = inject(Router);
  const deviceTrustService = inject(DeviceTrustServiceAbstraction);
  const vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
  const logService = inject(LogService);

  const activeUser = await firstValueFrom(accountService.activeAccount$);

  if (!activeUser) {
    return true;
  }

  const authStatus = await firstValueFrom(authService.authStatusFor$(activeUser.id));

  if (authStatus == null || authStatus === AuthenticationStatus.LoggedOut) {
    return true;
  }

  if (authStatus === AuthenticationStatus.Unlocked) {
    return router.createUrlTree([routes.homepage()]);
  }

  const tdeEnabled = await firstValueFrom(
    deviceTrustService.supportsDeviceTrustByUserId$(activeUser.id),
  );
  const canLockVault = await vaultTimeoutSettingsService.canLock(activeUser.id);

  // If locked, TDE is enabled, and the user has no unlock methods available, then redirect to the
  // login decryption options component.
  if (authStatus === AuthenticationStatus.Locked && tdeEnabled && !canLockVault) {
    logService.info(
      "Sending user to TDE decryption options. AuthStatus is %s. TDE support is %s. Can lock is %s.",
      AuthenticationStatus[authStatus],
      tdeEnabled,
      canLockVault,
    );
    return router.createUrlTree(["/login-initiated"]);
  }

  return router.createUrlTree([routes.locked]);
}

export function unauthGuardFn(overrides: Partial<UnauthRoutes> = {}): CanActivateFn {
  return async (route) => unauthGuard(route, { ...defaultRoutes, ...overrides });
}
