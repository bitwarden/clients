import { MockProxy, mock } from "jest-mock-extended";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";

import { LogoutService } from "../../abstractions";
import { LogoutReason } from "../../types";

import { DefaultLogoutService } from "./default-logout.service";

describe("DefaultLogoutService", () => {
  let logoutService: LogoutService;
  let messagingService: MockProxy<MessagingService>;

  beforeEach(() => {
    messagingService = mock<MessagingService>();
    logoutService = new DefaultLogoutService(messagingService);
  });

  it("instantiates", () => {
    expect(logoutService).not.toBeFalsy();
  });

  describe("logout", () => {
    it("sends logout message without a logout reason when not provided", async () => {
      const userId = "1" as UserId;

      await logoutService.logout(userId);

      expect(messagingService.send).toHaveBeenCalledWith("logout", { userId });
    });

    it("sends logout message with a logout reason when provided", async () => {
      const userId = "1" as UserId;
      const logoutReason: LogoutReason = "vaultTimeout";
      await logoutService.logout(userId, logoutReason);
      expect(messagingService.send).toHaveBeenCalledWith("logout", { userId, logoutReason });
    });
  });
});
