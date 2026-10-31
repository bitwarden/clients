import { mock } from "jest-mock-extended";

import { LogoutService, NewActiveUser } from "@bitwarden/common/auth/logout";
import { UserId } from "@bitwarden/common/types/guid";

import { DeferredLogoutService } from "./deferred-logout.service";

describe("DeferredLogoutService", () => {
  const userId = "user-id" as UserId;

  it("forwards the logout to the resolved LogoutService and returns its result", async () => {
    const newActiveUser = { userId: "next-user-id" } as NewActiveUser;
    const logoutService = mock<LogoutService>();
    logoutService.logout.mockResolvedValue(newActiveUser);
    const sut = new DeferredLogoutService(() => logoutService);

    const result = await sut.logout(userId, "userInitiated");

    expect(logoutService.logout).toHaveBeenCalledWith(userId, "userInitiated");
    expect(result).toBe(newActiveUser);
  });

  it("resolves the LogoutService when logout is called, not when constructed", async () => {
    const container: { logoutService?: LogoutService } = {};
    const sut = new DeferredLogoutService(() => container.logoutService);
    const logoutService = mock<LogoutService>();
    container.logoutService = logoutService;

    await sut.logout(userId, "userInitiated");

    expect(logoutService.logout).toHaveBeenCalledWith(userId, "userInitiated");
  });

  it("rejects with a descriptive error when the LogoutService is not yet constructed", async () => {
    const sut = new DeferredLogoutService(() => undefined);

    await expect(sut.logout(userId, "invalidAccessToken")).rejects.toThrow(
      'Logout requested for reason "invalidAccessToken" before the LogoutService was constructed.',
    );
  });
});
