import { firstValueFrom } from "rxjs";

import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";

import { DefaultManagedSettingsService } from "./default-managed-settings.service";

// Factory must be self-contained because jest.mock is hoisted before class declarations.
jest.mock("@bitwarden/sdk-internal", () => {
  class ManagedSettingsClient {
    private _settings = new Map<string, string>();

    is_managed(key: string): boolean {
      return this._settings.has(key);
    }

    get(key: string): string | undefined {
      return this._settings.get(key);
    }

    update_profile(profile?: { settings?: Map<string, string> } | null): void {
      this._settings = profile?.settings ?? new Map<string, string>();
    }
  }

  // SdkLoadService imports LogLevel and init_sdk from this module.
  const LogLevel = { Trace: 0, Debug: 1, Info: 2, Warn: 3, Error: 4 };
  const init_sdk = (): undefined => undefined;

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

  it("pushExplicit deep-flattens nested objects to dotted keys", async () => {
    const svc = new DefaultManagedSettingsService();
    await firstValueFrom(svc.handle$);

    svc.pushExplicit({ environment: { base: "https://x" } });

    expect(svc.isManaged("environment.base")).toBe(true);
    expect(svc.get("environment.base")).toBe('"https://x"');
    expect(svc.isManaged("environment")).toBe(false);
  });

  it("applies a profile pushed before the handle is ready", async () => {
    const svc = build();
    svc.pushExplicit({ "generator.password.length": 20 }); // before awaiting handle$
    await firstValueFrom(svc.handle$);
    expect(svc.isManaged("generator.password.length")).toBe(true);
    expect(svc.get("generator.password.length")).toBe("20");
  });
});
