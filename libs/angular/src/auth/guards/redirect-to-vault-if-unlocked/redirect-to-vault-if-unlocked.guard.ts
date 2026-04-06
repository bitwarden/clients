import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

/**
 * Redirects the user to `/vault` if they are `Unlocked`. Otherwise, it allows access to the route.
 * See ./redirect-to-vault-if-unlocked/README.md for more details.
 */
export function redirectToVaultIfUnlockedGuard(): CanActivateFn {
  return async () => {
    const accountService = inject(AccountService);
    const authService = inject(AuthService);
    const router = inject(Router);

    const activeUser = await firstValueFrom(accountService.activeAccount$);

    // If there is no active user, allow access to the route
    if (!activeUser) {
      return true;
    }

    const authStatus = await firstValueFrom(authService.authStatusFor$(activeUser.id));

    // If user is Unlocked, redirect to vault
    if (authStatus === AuthenticationStatus.Unlocked) {
      return router.createUrlTree(["/vault"]);
    }

    // If user is LoggedOut or Locked, allow access to the route
    return true;
  };
}
