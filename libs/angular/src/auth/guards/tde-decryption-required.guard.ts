import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  CanActivateFn,
} from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { KeyService } from "@bitwarden/key-management";

/**
 * Only allow access to this route if the vault is locked and has never been decrypted.
 * Otherwise redirect to root.
 *
 * TODO: This should return Observable<boolean | UrlTree> once we can get rid of all the promises
 */
export function tdeDecryptionRequiredGuard(): CanActivateFn {
  return async (_: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const keyService = inject(KeyService);
    const deviceTrustService = inject(DeviceTrustServiceAbstraction);
    const accountService = inject(AccountService);
    const logService = inject(LogService);
    const router = inject(Router);

    const userId = await firstValueFrom(accountService.activeAccount$.pipe(map((a) => a?.id)));
    if (userId == null) {
      return router.createUrlTree(["/"]);
    }

    const authStatus = await authService.getAuthStatus();
    const tdeEnabled = await firstValueFrom(deviceTrustService.supportsDeviceTrust$);
    const everHadUserKey = await firstValueFrom(keyService.everHadUserKey$(userId));

    // We need to determine if we should bypass the decryption options and send the user to the vault.
    // The ONLY time that we want to send a user to the decryption options is when:
    // 1. The user's auth status is Locked, AND
    // 2. TDE is enabled, AND
    // 3. The user has never had a user key in state since last logout.
    // The inverse of this is when we should send the user to the vault.
    if (authStatus !== AuthenticationStatus.Locked || !tdeEnabled || everHadUserKey) {
      return router.createUrlTree(["/"]);
    }

    logService.info(
      "Sending user to TDE decryption options. AuthStatus is %s. TDE support is %s. Ever had user key is %s.",
      AuthenticationStatus[authStatus],
      tdeEnabled,
      everHadUserKey,
    );

    return true;
  };
}
