/**
 * Regression guard for Plan J Critical Defect C1:
 *
 * Consumers that inject GlobalStateProvider directly (e.g. appearance services) were not
 * seeing managed values because the old ManagedOverlayStateProvider only wrapped StateProvider,
 * not GlobalStateProvider. This test constructs OverlayGlobalStateProvider over a REAL
 * DefaultGlobalStateProvider (backed by in-memory storage) and asserts that a read through
 * the GlobalStateProvider-typed handle returns the managed value.
 */
import { mock } from "jest-mock-extended";
import { Subject, firstValueFrom } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { KeyDefinition, StateDefinition } from "@bitwarden/state";
import { DefaultGlobalStateProvider } from "@bitwarden/state-internal";
import { StorageServiceProvider } from "@bitwarden/storage-core";
import { FakeStorageService } from "@bitwarden/storage-test-utils";

import { __resetOverlaysForTests, defineManagedOverlay } from "./managed-overlay-registry";
import { OverlayGlobalStateProvider } from "./managed-overlay-state.provider";
import { ManagedSettingsService } from "./managed-settings.service";

const SD = new StateDefinition("c1RegressionTest", "disk");
const KEY = new KeyDefinition<string>(SD, "theme", { deserializer: (v) => v as string });

function makeRealGlobalStateProvider(): DefaultGlobalStateProvider {
  const diskStorage = new FakeStorageService();
  const storageServiceProvider = new StorageServiceProvider(diskStorage, diskStorage);
  const logService = mock<LogService>();
  return new DefaultGlobalStateProvider(storageServiceProvider, logService);
}

function makeManagedSettingsService(managedValue: string | undefined): ManagedSettingsService {
  const changes$ = new Subject<void>();
  return {
    changes$,
    get: (_key: string) => managedValue,
    isManaged: (_key: string) => managedValue != null,
  } as unknown as ManagedSettingsService;
}

describe("C1 regression: OverlayGlobalStateProvider over real DefaultGlobalStateProvider", () => {
  beforeEach(() => {
    __resetOverlaysForTests();
  });

  it("returns the managed value when read through a GlobalStateProvider-typed handle", async () => {
    defineManagedOverlay({
      keyDefinition: KEY,
      coerce: (get) => get("appearance.theme") ?? null,
    });

    const inner = makeRealGlobalStateProvider();
    const managedSettings = makeManagedSettingsService("dark");

    // Cast to the abstract type — this mirrors the injection site in appearance services.
    const provider: import("@bitwarden/state").GlobalStateProvider = new OverlayGlobalStateProvider(
      inner,
      managedSettings,
    );

    const value = await firstValueFrom(provider.get(KEY).state$);
    expect(value).toBe("dark");
  });

  it("returns the stored value when no managed value is present", async () => {
    defineManagedOverlay({
      keyDefinition: KEY,
      coerce: (get) => get("appearance.theme") ?? null,
    });

    const inner = makeRealGlobalStateProvider();
    const managedSettings = makeManagedSettingsService(undefined);

    const provider: import("@bitwarden/state").GlobalStateProvider = new OverlayGlobalStateProvider(
      inner,
      managedSettings,
    );

    // No stored value — the real provider returns null for an empty store.
    const value = await firstValueFrom(provider.get(KEY).state$);
    expect(value).toBeNull();
  });
});
