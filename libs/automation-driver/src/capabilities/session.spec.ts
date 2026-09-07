import { of } from "rxjs";

import { SessionCapability } from "./session";

describe("SessionCapability", () => {
  it("signs out a single account", async () => {
    const logout = jest.fn();
    const capability = new SessionCapability({ accounts$: of({}) } as any, { logout } as any);

    await capability.logout("user-1" as any);

    expect(logout).toHaveBeenCalledWith("user-1");
  });

  it("signs out every known account", async () => {
    const logout = jest.fn();
    const accounts$ = of({ "user-1": {}, "user-2": {} });
    const capability = new SessionCapability({ accounts$ } as any, { logout } as any);

    await capability.logoutAll();

    expect(logout).toHaveBeenCalledWith("user-1");
    expect(logout).toHaveBeenCalledWith("user-2");
  });
});
