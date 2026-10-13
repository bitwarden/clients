import { inject } from "@angular/core";
import { CanDeactivateFn } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

/** A routed component that may hold input the user would lose by leaving. */
export interface HasUnsavedChanges {
  /** Resolves true when leaving is safe: nothing is pending, or the user agreed to leave anyway. */
  confirmLeave(): boolean | Promise<boolean>;
}

/**
 * Asks the component before navigating away. Lock and logout always win, so the guard lets those
 * through without asking, as it does when Angular passes no component during teardown.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = async (component) => {
  const authService = inject(AuthService);

  if (component == null) {
    return true;
  }

  const status = await firstValueFrom(authService.activeAccountStatus$);
  if (status !== AuthenticationStatus.Unlocked) {
    return true;
  }

  return await component.confirmLeave();
};
