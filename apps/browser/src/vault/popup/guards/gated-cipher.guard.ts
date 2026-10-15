import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";

/**
 * Sends a write route (edit, clone, assign collections) for a PAM-gated ("partial") item to the
 * item's read-only view.
 */
export const gatedCipherGuard: CanActivateFn = async (route) => {
  const accountService = inject(AccountService);
  const cipherService = inject(CipherService);
  const router = inject(Router);

  const { cipherId, type } = route.queryParams;
  const userId = await firstValueFrom(accountService.activeAccount$.pipe(getOptionalUserId));
  if (!cipherId || !userId) {
    return true;
  }

  const cipher = await cipherService.get(cipherId, userId);
  if (!cipher?.isPartial) {
    return true;
  }

  return router.createUrlTree(["/view-cipher"], { queryParams: { cipherId, type } });
};
