import { MockProxy, mock } from "jest-mock-extended";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { LogoutService } from "../../abstractions";
import { LogoutReason } from "../../types";

import { DefaultLogoutService } from "./default-logout.service";

describe("DefaultLogoutService", () => {
  let logoutService: LogoutService;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let sdkService: MockProxy<SdkService>;

  beforeEach(() => {
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    sdkService = mock<SdkService>();
    logoutService = new DefaultLogoutService(messagingService, logService, sdkService);
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

    it("disposes the SDK client before sending the logout message", async () => {
      const userId = "1" as UserId;

      await logoutService.logout(userId, "userInitiated");

      expect(sdkService.logout).toHaveBeenCalledWith(userId);
      expect(sdkService.logout.mock.invocationCallOrder[0]).toBeLessThan(
        messagingService.send.mock.invocationCallOrder[0],
      );
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
