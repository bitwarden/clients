import { firstValueFrom } from "rxjs";

import { LogoutService } from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { UserId } from "@bitwarden/common/types/guid";

import { AutomationCapability } from "../automation-capability";

/**
 * Ends sessions on the client.
 *
 * A test that needs the client to hold a particular account cannot get there through the UI alone:
 * signing out is reachable only from an account menu that is absent while signed out, so a run
 * cannot normalise a client it did not start.
 */
export class SessionCapability extends AutomationCapability {
  readonly automationName = "session";

  constructor(
    private accountService: AccountService,
    private logoutService: LogoutService,
  ) {
    super();
  }

  /** Sign out a single account. */
  async logout(userId: UserId): Promise<void> {
    await this.logoutService.logout(userId);
  }

  /** Sign out every known account, leaving the client with none. */
  async logoutAll(): Promise<void> {
    const accounts = await firstValueFrom(this.accountService.accounts$);

    for (const userId of Object.keys(accounts)) {
      await this.logoutService.logout(userId as UserId);
    }
  }
}
