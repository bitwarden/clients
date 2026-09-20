import { LogService } from "@bitwarden/logging";

import { MessagingService } from "../../platform/abstractions/messaging.service";
import { UserId } from "../../types/guid";

import { LogoutReason } from "./logout-reason.type";
import { LogoutService, NewActiveUser } from "./logout.service";

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
