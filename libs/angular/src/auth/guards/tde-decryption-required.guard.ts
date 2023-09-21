import { inject } from "@angular/core";
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  CanActivateFn,
} from "@angular/router";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";

/**
 * Only allow access to this route if the vault is locked and has never been decrypted.
 * Otherwise redirect to root.
 */
export function tdeDecryptionRequiredGuard(): CanActivateFn {
  return async (_: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const authService = inject(AuthService);
    const cryptoService = inject(CryptoService);
    const deviceTrustCryptoService = inject(DeviceTrustCryptoServiceAbstraction);
    const router = inject(Router);

    const authStatus = await authService.getAuthStatus();
    const tdeEnabled = await deviceTrustCryptoService.supportsDeviceTrust();
    const everHadUserKey = await cryptoService.getEverHadUserKey();
    if (authStatus !== AuthenticationStatus.Locked || !tdeEnabled || everHadUserKey) {
      return router.createUrlTree(["/"]);
    }

    return true;
  };
}
