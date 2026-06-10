import {
  DefaultLogoutService,
  LogoutReason,
  LogoutService,
  NewActiveUser,
} from "@bitwarden/auth/common";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";

import { AccountSwitcherService } from "../account-switching/services/account-switcher.service";

export class ExtensionLogoutService extends DefaultLogoutService implements LogoutService {
  constructor(
    protected messagingService: MessagingService,
    private accountSwitcherService: AccountSwitcherService,
    sdkService: SdkService,
  ) {
    super(messagingService, sdkService);
  }

  override async logout(
    userId: UserId,
    logoutReason?: LogoutReason,
  ): Promise<NewActiveUser | undefined> {
    // logout can result in an account switch to the next up user
    const accountSwitchFinishPromise =
      this.accountSwitcherService.listenForSwitchAccountFinish(null);

    // Dispose the user's SDK client (frees the in-memory key) before broadcasting logout.
    this.sdkService.logout(userId);
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
