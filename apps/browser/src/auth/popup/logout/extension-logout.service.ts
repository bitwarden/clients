import {
  DefaultLogoutService,
  LogoutReason,
  LogoutService,
  NewActiveUser,
} from "@bitwarden/common/auth/logout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { AccountSwitcherService } from "../account-switching/services/account-switcher.service";

export class ExtensionLogoutService extends DefaultLogoutService implements LogoutService {
  constructor(
    protected messagingService: MessagingService,
    protected logService: LogService,
    private accountSwitcherService: AccountSwitcherService,
  ) {
    super(messagingService, logService);
  }

  override async logout(
    userId: UserId,
    logoutReason: LogoutReason,
  ): Promise<NewActiveUser | undefined> {
    this.logService.info("Logging out user %s for reason: %s", userId, logoutReason);
    // logout can result in an account switch to the next up user
    const accountSwitchFinishPromise =
      this.accountSwitcherService.listenForSwitchAccountFinish(null);

    // send the logout message
    this.messagingService.send("logout", { userId, logoutReason });

    // wait for the account switch to finish
    const result = await accountSwitchFinishPromise;
    if (result) {
      return { userId: result.userId, authenticationStatus: result.authenticationStatus };
    }
    // if there is no account switch, return undefined
    return undefined;
  }
}
