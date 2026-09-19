import { MockProxy, mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";

import { MessagingService } from "../../platform/abstractions/messaging.service";
import { UserId } from "../../types/guid";

import { DefaultLogoutService } from "./default-logout.service";
import { LogoutReason } from "./logout-reason.type";
import { LogoutService } from "./logout.service";

describe("DefaultLogoutService", () => {
  let logoutService: LogoutService;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;

  beforeEach(() => {
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    logoutService = new DefaultLogoutService(messagingService, logService);
  });

  it("instantiates", () => {
    expect(logoutService).not.toBeFalsy();
  });

  describe("logout", () => {
    it("sends logout message with the provided reason", async () => {
      const userId = "1" as UserId;
      const logoutReason: LogoutReason = "vaultTimeout";

      await logoutService.logout(userId, logoutReason);

      expect(messagingService.send).toHaveBeenCalledWith("logout", { userId, logoutReason });
    });

    it("logs an info message with the user id and reason", async () => {
      const userId = "1" as UserId;
      const logoutReason: LogoutReason = "userInitiated";

      await logoutService.logout(userId, logoutReason);

      expect(logService.info).toHaveBeenCalledWith(
        "Logging out user %s for reason: %s",
        userId,
        logoutReason,
      );
    });
  });
});
