import { of } from "rxjs";

import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { UserId } from "@bitwarden/common/types/guid";
import { LockSource } from "@bitwarden/unlock";

import { CliLogoutService } from "../auth/logout/cli-logout.service";

import { ServiceContainer } from "./service-container";

describe("ServiceContainer", () => {
  it("instantiates", async () => {
    expect(() => new ServiceContainer()).not.toThrow();
  });

  it("constructs a CliLogoutService for logout", () => {
    const serviceContainer = new ServiceContainer();

    expect(serviceContainer.logoutService).toBeInstanceOf(CliLogoutService);
  });

  it("logs out through the CliLogoutService when the lock service cannot lock the user", async () => {
    const userId = "user-id" as UserId;
    const serviceContainer = new ServiceContainer();
    jest
      .spyOn(serviceContainer.authService, "authStatusFor$")
      .mockReturnValue(of(AuthenticationStatus.Unlocked));
    jest.spyOn(serviceContainer.vaultTimeoutSettingsService, "canLock").mockResolvedValue(false);
    const logoutSpy = jest
      .spyOn(serviceContainer.logoutService, "logout")
      .mockResolvedValue(undefined);

    await serviceContainer.lockService.lock(userId, LockSource.Manual);

    expect(logoutSpy).toHaveBeenCalledWith(userId, "vaultTimeout");
  });
});
