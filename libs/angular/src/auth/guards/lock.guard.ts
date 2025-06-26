import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { KeyService } from "@bitwarden/key-management";

/**
 * Only allow access to this route if the vault is locked.
 * If TDE is enabled then the user must also have had a user key at some point.
 * Otherwise reject navigation.
 *
 * TODO: This should return Observable<boolean | UrlTree> once we can remove all the promises
 */
export function lockGuard(): CanActivateFn {
  return async (
    activatedRouteSnapshot: ActivatedRouteSnapshot,
    routerStateSnapshot: RouterStateSnapshot,
  ) => {
    const authService = inject(AuthService);
    const keyService = inject(KeyService);
    const deviceTrustService = inject(DeviceTrustServiceAbstraction);
    const router = inject(Router);
    const userVerificationService = inject(UserVerificationService);
    const vaultTimeoutSettingsService = inject(VaultTimeoutSettingsService);
    const accountService = inject(AccountService);

    const activeUser = await firstValueFrom(accountService.activeAccount$);

    // If no active user, redirect to root:
    // scenario context: user logs out on lock screen and app will reload lock comp without active user
    if (!activeUser) {
      return router.createUrlTree(["/"]);
    }

    const authStatus = await firstValueFrom(authService.authStatusFor$(activeUser.id));
    if (authStatus !== AuthenticationStatus.Locked) {
      return router.createUrlTree(["/"]);
    }

    // if user can't lock, they can't access the lock screen
    const canLock = await vaultTimeoutSettingsService.canLock(activeUser.id);
    if (!canLock) {
      return false;
    }

    // User is authN and in locked state.

    const tdeEnabled = await firstValueFrom(deviceTrustService.supportsDeviceTrust$);

    // Create special exception which allows users to go from the login-initiated page to the lock page for the approve w/ MP flow
    // The MP check is necessary to prevent direct manual navigation from other locked state pages for users who don't have a MP
    if (
      activatedRouteSnapshot.queryParams["from"] === "login-initiated" &&
      tdeEnabled &&
      (await userVerificationService.hasMasterPassword())
    ) {
      return true;
    }

    // If authN user with TDE directly navigates to lock, reject that navigation
    const everHadUserKey = await firstValueFrom(keyService.everHadUserKey$(activeUser.id));
    if (tdeEnabled && !everHadUserKey) {
      return false;
    }

    return true;
  };
}
