import { firstValueFrom } from "rxjs";

import { ManagementProfile } from "@bitwarden/sdk-internal";

import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";

import { DevManagedSettingsService } from "./dev-managed-settings.service";

class TestSdkLoadService extends SdkLoadService {
  protected override load(): Promise<void> {
    return Promise.resolve();
  }
}

describe("DevManagedSettingsService", () => {
  beforeEach(async () => {
    await new TestSdkLoadService().loadAndInit();
  });

  it("flattens a nested map to dotted JSON leaves that read the same as an equivalent updateProfile", async () => {
    const pushed = new DevManagedSettingsService();
    const equivalent = new DevManagedSettingsService();
    await firstValueFrom(pushed.client$);
    await firstValueFrom(equivalent.client$);

    pushed.pushExplicit({
      environment: { base: "https://vault" },
      generator: { password: { length: 42 } },
    });

    const flattened: ManagementProfile = {
      version: 1,
      updatedAt: 0,
      settings: new Map([
        ["environment.base", JSON.stringify("https://vault")],
        ["generator.password.length", JSON.stringify(42)],
      ]),
    };
    equivalent.updateProfile(flattened);

    for (const key of ["environment.base", "generator.password.length"]) {
      expect(pushed.get(key)).toBe(equivalent.get(key));
      expect(pushed.isManaged(key)).toBe(equivalent.isManaged(key));
    }
    expect(pushed.get("environment.base")).toBe('"https://vault"');
    expect(pushed.get("generator.password.length")).toBe("42");
  });
});
