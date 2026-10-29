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
});
