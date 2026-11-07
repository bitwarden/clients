import { LogoutReason, LogoutService, NewActiveUser } from "@bitwarden/common/auth/logout";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * Forwards to a LogoutService that is resolved when a logout happens, not at construction. This
 * lets services that must exist before the real LogoutService can be built still depend on it.
 */
export class DeferredLogoutService implements LogoutService {
  constructor(private resolveLogoutService: () => LogoutService | undefined) {}

  async logout(userId: UserId, logoutReason: LogoutReason): Promise<NewActiveUser | undefined> {
    const logoutService = this.resolveLogoutService();
    if (logoutService == null) {
      throw new Error(
        `Logout requested for reason "${logoutReason}" before the LogoutService was constructed.`,
      );
    }
    return await logoutService.logout(userId, logoutReason);
  }
}
