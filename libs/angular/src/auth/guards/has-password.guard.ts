import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

// eslint-disable-next-line no-restricted-imports
import { UserDecryptionOptionsServiceAbstraction } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";

/**
 * Guard that checks if the active user has a password.
 * If not, redirects to the specified route.
 * @param redirectTo The route to redirect to if the user does not have a password
 */
export function hasPasswordGuard(redirectTo: string[] = ["/"]) {
  return async () => {
    const userDecryptionOptionsService = inject(UserDecryptionOptionsServiceAbstraction);
    const accountService = inject(AccountService);
    const router = inject(Router);

    const userId = await firstValueFrom(accountService.activeAccount$.pipe(getUserId));
    const userHasPassword = await firstValueFrom(
      userDecryptionOptionsService.hasMasterPasswordById$(userId),
    );

    if (!userHasPassword) {
      return router.createUrlTree(redirectTo);
    }

    return true;
  };
}
