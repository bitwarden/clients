import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";

import { LogoutService, NewActiveUser } from "../../abstractions/logout.service";
import { LogoutReason } from "../../types";

export class DefaultLogoutService implements LogoutService {
  constructor(
    protected messagingService: MessagingService,
    protected sdkService: SdkService,
  ) {}
  async logout(userId: UserId, logoutReason?: LogoutReason): Promise<NewActiveUser | undefined> {
    // Dispose the user's SDK client (frees the in-memory key) before broadcasting logout.
    this.sdkService.logout(userId);
    this.messagingService.send("logout", { userId, logoutReason });

    return undefined;
  }
}
