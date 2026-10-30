import { MockProxy, mock } from "jest-mock-extended";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { LogoutReason, LogoutService } from "@bitwarden/common/auth/logout";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { AccountSwitcherService } from "../account-switching/services/account-switcher.service";

import { ExtensionLogoutService } from "./extension-logout.service";

describe("ExtensionLogoutService", () => {
  let logoutService: LogoutService;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let accountSwitcherService: MockProxy<AccountSwitcherService>;

  let primaryUserId: UserId;
  let secondaryUserId: UserId;
  let logoutReason: LogoutReason;

  beforeEach(() => {
    primaryUserId = "1" as UserId;
    secondaryUserId = "2" as UserId;
    logoutReason = "vaultTimeout";

    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    accountSwitcherService = mock<AccountSwitcherService>();
    logoutService = new ExtensionLogoutService(
      messagingService,
      logService,
      accountSwitcherService,
    );
  });

  it("instantiates", () => {
    expect(logoutService).not.toBeFalsy();
  });

  describe("logout", () => {
    describe("No new active user", () => {
      beforeEach(() => {
        accountSwitcherService.listenForSwitchAccountFinish.mockResolvedValue(null);
      });

      it("sends logout message with the provided reason", async () => {
        const result = await logoutService.logout(primaryUserId, logoutReason);

        expect(accountSwitcherService.listenForSwitchAccountFinish).toHaveBeenCalledTimes(1);
        expect(messagingService.send).toHaveBeenCalledWith("logout", {
          userId: primaryUserId,
          logoutReason,
        });
        expect(result).toBeUndefined();
      });

      it("logs an info message with the user id and reason", async () => {
        await logoutService.logout(primaryUserId, logoutReason);

        expect(logService.info).toHaveBeenCalledWith(
          "Logging out user %s for reason: %s",
          primaryUserId,
          logoutReason,
        );
      });
    });

    describe("New active user", () => {
      const newActiveUserAuthenticationStatus = AuthenticationStatus.Unlocked;

      beforeEach(() => {
        accountSwitcherService.listenForSwitchAccountFinish.mockResolvedValue({
          userId: secondaryUserId,
          authenticationStatus: newActiveUserAuthenticationStatus,
        });
      });

      it("sends logout message with the provided reason and returns the new active user", async () => {
        const result = await logoutService.logout(primaryUserId, logoutReason);

        expect(accountSwitcherService.listenForSwitchAccountFinish).toHaveBeenCalledTimes(1);
        expect(messagingService.send).toHaveBeenCalledWith("logout", {
          userId: primaryUserId,
          logoutReason,
        });
        expect(result).toEqual({
          userId: secondaryUserId,
          authenticationStatus: newActiveUserAuthenticationStatus,
        });
      });
    });
  });
});
