import { firstValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { LogoutReason, LogoutService } from "@bitwarden/common/auth/logout";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * Creates a logout function for services that take one instead of a LogoutService. The function
 * logs out the given user, or the active user when the caller does not give a user ID.
 */
export function createLogoutCallback(
  logoutService: LogoutService,
  accountService: AccountService,
): (logoutReason: LogoutReason, userId?: string) => Promise<void> {
  return async (logoutReason, userId) => {
    const userIdToLogOut =
      (userId as UserId | undefined) ??
      (await firstValueFrom(getUserId(accountService.activeAccount$)));
    await logoutService.logout(userIdToLogOut, logoutReason);
  };
}
