import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { LogoutService, NewActiveUser } from "../../abstractions/logout.service";
import { LogoutReason } from "../../types";

export class DefaultLogoutService implements LogoutService {
  constructor(
    protected messagingService: MessagingService,
    protected logService: LogService,
  ) {}
  async logout(userId: UserId, logoutReason: LogoutReason): Promise<NewActiveUser | undefined> {
    this.logService.info("Logging out user %s for reason: %s", userId, logoutReason);
    this.messagingService.send("logout", { userId, logoutReason });
    return undefined;
  }
}
