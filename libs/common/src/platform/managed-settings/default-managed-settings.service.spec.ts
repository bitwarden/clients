import { firstValueFrom } from "rxjs";

import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";

import { DefaultManagedSettingsService } from "./default-managed-settings.service";

// Factory must be self-contained because jest.mock is hoisted before class declarations.
jest.mock("@bitwarden/sdk-internal", () => {
  class ManagedSettingsClient {
    private _settings: Record<string, string> = {};

    is_managed(key: string): boolean {
      return Object.prototype.hasOwnProperty.call(this._settings, key);
    }

    get(key: string): string | undefined {
      return this._settings[key];
    }

    update_profile(profile?: { settings?: Record<string, string> } | null): void {
      this._settings = profile?.settings ?? {};
    }
  }

  // SdkLoadService imports LogLevel and init_sdk from this module.
  const LogLevel = { Trace: 0, Debug: 1, Info: 2, Warn: 3, Error: 4 };
  const init_sdk = () => undefined;

  return { ManagedSettingsClient, LogLevel, init_sdk };
});

class TestSdkLoadService extends SdkLoadService {
  protected override load(): Promise<void> {
    return Promise.resolve();
  }
}

describe("DefaultManagedSettingsService", () => {
  beforeAll(async () => {
    await new TestSdkLoadService().loadAndInit();
  });

  function build() {
    return new DefaultManagedSettingsService();
  }

  it("reports unmanaged before any profile is pushed", async () => {
    const svc = build();
    await firstValueFrom(svc.handle$);
    expect(svc.isManaged("generator.password.length")).toBe(false);
    expect(svc.get("generator.password.length")).toBeUndefined();
  });

  it("pushExplicit makes keys managed and fires changes$", async () => {
    const svc = build();
    await firstValueFrom(svc.handle$);
    const changed = firstValueFrom(svc.changes$);
    svc.pushExplicit({ "generator.password.length": 20 });
    await changed;
    expect(svc.isManaged("generator.password.length")).toBe(true);
    expect(svc.get("generator.password.length")).toBe("20"); // JSON-encoded
  });
});
