import { firstValueFrom } from "rxjs";

import { ManagementProfile } from "@bitwarden/sdk-internal";

import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";

import { DefaultManagedSettingsService } from "./default-managed-settings.service";

class TestSdkLoadService extends SdkLoadService {
  protected override load(): Promise<void> {
    // Simulate successful WASM load; the node SDK build initializes WASM at require time.
    return Promise.resolve();
  }
}

function profile(entries: Record<string, string>): ManagementProfile {
  return { version: 1, updatedAt: 0, settings: new Map(Object.entries(entries)) };
}

describe("DefaultManagedSettingsService", () => {
  beforeEach(async () => {
    await new TestSdkLoadService().loadAndInit();
  });

  it("reflects the active profile through get and isManaged", async () => {
    const service = new DefaultManagedSettingsService();
    await firstValueFrom(service.client$);

    service.updateProfile(profile({ "environment.base": '"https://vault"' }));

    expect(service.get("environment.base")).toBe('"https://vault"');
    expect(service.isManaged("environment.base")).toBe(true);
    expect(service.get("missing")).toBeUndefined();
    expect(service.isManaged("missing")).toBe(false);
  });

  it("clears the active profile when updateProfile is passed undefined", async () => {
    const service = new DefaultManagedSettingsService();
    await firstValueFrom(service.client$);

    service.updateProfile(profile({ "environment.base": '"https://vault"' }));
    service.updateProfile(undefined);

    expect(service.get("environment.base")).toBeUndefined();
    expect(service.isManaged("environment.base")).toBe(false);
  });

  it("seeds get$ with the current value and re-emits on change, suppressing unchanged pushes", async () => {
    const service = new DefaultManagedSettingsService();
    await firstValueFrom(service.client$);

    const emissions: (string | undefined)[] = [];
    const sub = service.get$("environment.base").subscribe((value) => emissions.push(value));

    service.updateProfile(profile({ "environment.base": '"https://vault"' }));
    // An unchanged value must be suppressed by distinctUntilChanged.
    service.updateProfile(profile({ "environment.base": '"https://vault"' }));
    service.updateProfile(profile({ "environment.base": '"https://other"' }));

    sub.unsubscribe();

    expect(emissions).toEqual([undefined, '"https://vault"', '"https://other"']);
  });

  it("buffers an updateProfile that arrives before the handle resolves and applies it once ready", async () => {
    const service = new DefaultManagedSettingsService();

    // The WASM handle is created asynchronously after SdkLoadService.Ready, so it does not yet
    // exist synchronously after construction.
    service.updateProfile(profile({ "environment.base": '"https://vault"' }));
    expect(service.get("environment.base")).toBeUndefined();

    await firstValueFrom(service.client$);

    expect(service.get("environment.base")).toBe('"https://vault"');
    expect(service.isManaged("environment.base")).toBe(true);
  });
});
