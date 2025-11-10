import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { combineLatest, map, switchMap, distinctUntilChanged } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import { DesktopSettingsService } from "../../platform/services/desktop-settings.service";

/**
 * Reactive route guard that redirects to the unlocked vault.
 * Redirects to vault when unlocked in main window.
 */
export const reactiveUnlockVaultGuard: CanActivateFn = () => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const accountService = inject(AccountService);
  const desktopSettingsService = inject(DesktopSettingsService);

  return combineLatest([accountService.activeAccount$, desktopSettingsService.modalMode$]).pipe(
    switchMap(([account, modalMode]) => {
      if (!account) {
        return [true];
      }

      // Monitor  when the vault has been unlocked.
      return authService.authStatusFor$(account.id).pipe(
        distinctUntilChanged(),
        map((authStatus) => {
          // If vault is unlocked and we're not in modal mode, redirect to vault
          if (authStatus === AuthenticationStatus.Unlocked && !modalMode?.isModalModeActive) {
            return router.createUrlTree(["/vault"]);
          }

          // Otherwise keep user on the lock screen
          return true;
        }),
      );
    }),
  );
};
