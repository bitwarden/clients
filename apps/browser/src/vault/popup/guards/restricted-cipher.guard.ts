import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getOptionalUserId } from "@bitwarden/common/auth/services/account.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import {
  RestrictedCipherAction,
  RestrictedCipherPolicy,
} from "@bitwarden/common/vault/utils/restricted-cipher-policy";

/**
 * Sends a route for a restricted cipher to the item's view when the restricted-cipher rule blocks
 * `action`. For edit, it reveals first, so an edit under a live lease goes through.
 */
export const restrictedCipherGuard =
  (action: RestrictedCipherAction): CanActivateFn =>
  async (route) => {
    const accountService = inject(AccountService);
    const cipherService = inject(CipherService);
    const revealedCipherService = inject(RevealedCipherService);
    const router = inject(Router);

    const { cipherId, type } = route.queryParams;
    const userId = await firstValueFrom(accountService.activeAccount$.pipe(getOptionalUserId));
    if (!cipherId || !userId) {
      return true;
    }

    const cipher = await cipherService.get(cipherId, userId);
    if (cipher == null || !RestrictedCipherPolicy.isRestricted(cipher)) {
      return true;
    }

    const revealedView =
      action === RestrictedCipherAction.Edit
        ? await revealedCipherService.getOrReveal(userId, cipherId as CipherId)
        : undefined;
    if (RestrictedCipherPolicy.allows(cipher, action, revealedView ?? undefined)) {
      return true;
    }

    return router.createUrlTree(["/view-cipher"], { queryParams: { cipherId, type } });
  };
