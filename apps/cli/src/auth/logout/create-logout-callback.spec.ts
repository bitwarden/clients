import { mock, MockProxy } from "jest-mock-extended";

import { LogoutService } from "@bitwarden/common/auth/logout";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { createLogoutCallback } from "./create-logout-callback";

describe("createLogoutCallback", () => {
  const activeUserId = "active-user-id" as UserId;

  let logoutService: MockProxy<LogoutService>;
  let accountService: FakeAccountService;

  beforeEach(() => {
    logoutService = mock<LogoutService>();
    accountService = mockAccountServiceWith(activeUserId);
  });

  it("logs out the given user with the given reason", async () => {
    const otherUserId = "other-user-id" as UserId;
    const logoutCallback = createLogoutCallback(logoutService, accountService);

    await logoutCallback("invalidSecurityStamp", otherUserId);

    expect(logoutService.logout).toHaveBeenCalledWith(otherUserId, "invalidSecurityStamp");
  });

  it("logs out the active user when no user id is given", async () => {
    const logoutCallback = createLogoutCallback(logoutService, accountService);

    await logoutCallback("invalidAccessToken");

    expect(logoutService.logout).toHaveBeenCalledWith(activeUserId, "invalidAccessToken");
  });

  it("rejects without logging out when no user id is given and no account is active", async () => {
    accountService.activeAccountSubject.next(null);
    const logoutCallback = createLogoutCallback(logoutService, accountService);

    await expect(logoutCallback("invalidAccessToken")).rejects.toThrow();
    expect(logoutService.logout).not.toHaveBeenCalled();
  });
});
