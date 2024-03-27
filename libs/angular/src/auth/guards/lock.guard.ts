import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  CanActivateFn,
  Router,
  RouterStateSnapshot,
} from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ClientType } from "@bitwarden/common/enums";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

/**
 * Only allow access to this route if the vault is locked.
 * If TDE is enabled then the user must also have had a user key at some point.
 * Otherwise redirect to root.
 *
 * TODO: This should return Observable<boolean | UrlTree> once we can remove all the promises
 */
export function lockGuard(): CanActivateFn {
  return async (
    activatedRouteSnapshot: ActivatedRouteSnapshot,
    routerStateSnapshot: RouterStateSnapshot,
  ) => {
    const authService = inject(AuthService);
    const cryptoService = inject(CryptoService);
    const deviceTrustCryptoService = inject(DeviceTrustCryptoServiceAbstraction);
    const platformUtilService = inject(PlatformUtilsService);
    const messagingService = inject(MessagingService);
    const router = inject(Router);
    const userVerificationService = inject(UserVerificationService);

    const authStatus = await authService.getAuthStatus();
    if (authStatus !== AuthenticationStatus.Locked) {
      return router.createUrlTree(["/"]);
    }

    // If legacy user on web, redirect to migration page
    if (await cryptoService.isLegacyUser()) {
      if (platformUtilService.getClientType() === ClientType.Web) {
        return router.createUrlTree(["migrate-legacy-encryption"]);
      }
      // Log out legacy users on other clients
      messagingService.send("logout");
      return false;
    }

    // User is authN and in locked state.

    const tdeEnabled = await firstValueFrom(deviceTrustCryptoService.supportsDeviceTrust$);

    // Create special exception which allows users to go from the login-initiated page to the lock page for the approve w/ MP flow
    // The MP check is necessary to prevent direct manual navigation from other locked state pages for users who don't have a MP
    if (
      activatedRouteSnapshot.queryParams["from"] === "login-initiated" &&
      tdeEnabled &&
      (await userVerificationService.hasMasterPassword())
    ) {
      return true;
    }

    // If authN user with TDE directly navigates to lock, kick them upwards so redirect guard can
    // properly route them to the login decryption options component.
    const everHadUserKey = await firstValueFrom(cryptoService.everHadUserKey$);
    if (tdeEnabled && !everHadUserKey) {
      return router.createUrlTree(["/"]);
    }

    return true;
  };
}
