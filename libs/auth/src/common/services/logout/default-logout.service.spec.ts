import { MockProxy, mock } from "jest-mock-extended";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { LogoutService } from "../../abstractions";
import { LogoutReason } from "../../types";

import { DefaultLogoutService } from "./default-logout.service";

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
    it("sends logout message with a logout reason", async () => {
      const userId = "1" as UserId;
      const logoutReason: LogoutReason = "vaultTimeout";
      await logoutService.logout(userId, logoutReason);
      expect(messagingService.send).toHaveBeenCalledWith("logout", { userId, logoutReason });
    });
  });
});
