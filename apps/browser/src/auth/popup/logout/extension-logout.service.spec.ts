import { MockProxy, mock } from "jest-mock-extended";

import { LogoutReason, LogoutService } from "@bitwarden/auth/common";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { UserId } from "@bitwarden/common/types/guid";
import { LogService } from "@bitwarden/logging";

import { AccountSwitcherService } from "../account-switching/services/account-switcher.service";

import { ExtensionLogoutService } from "./extension-logout.service";

describe("ExtensionLogoutService", () => {
  let logoutService: LogoutService;
  let messagingService: MockProxy<MessagingService>;
  let accountSwitcherService: MockProxy<AccountSwitcherService>;
  let logService: MockProxy<LogService>;

  let primaryUserId: UserId;
  let secondaryUserId: UserId;
  let logoutReason: LogoutReason;

  beforeEach(() => {
    primaryUserId = "1" as UserId;
    secondaryUserId = "2" as UserId;
    logoutReason = "vaultTimeout";

    messagingService = mock<MessagingService>();
    accountSwitcherService = mock<AccountSwitcherService>();

    logoutService = new ExtensionLogoutService(
      messagingService,
      accountSwitcherService,
      logService,
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

      it("sends logout message with a logout reason", async () => {
        const result = await logoutService.logout(primaryUserId, logoutReason);

        expect(accountSwitcherService.listenForSwitchAccountFinish).toHaveBeenCalledTimes(1);
        expect(messagingService.send).toHaveBeenCalledWith("logout", {
          userId: primaryUserId,
          logoutReason,
        });
        expect(result).toBeUndefined();
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

      it("sends logout message with a logout reason and returns the new active  user", async () => {
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
