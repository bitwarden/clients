import { TestBed } from "@angular/core/testing";
import { firstValueFrom } from "rxjs";

import { BIT_SIDE_NAV_DISK, GlobalStateProvider, KeyDefinition } from "@bitwarden/state";

import { StorybookGlobalStateProvider } from "../utils/state-mock";

import { SideNavService } from "./side-nav.service";

// `StorybookGlobalStateProvider` caches state by the key definition's `fullName`, so a
// separately-constructed `KeyDefinition` with the same state definition and key resolves to the
// same underlying state as the one `SideNavService` uses internally, letting tests seed/read it
// without exporting the service's private key definition.
const collapsePreferenceKeyDef = new KeyDefinition<"open" | "closed" | null>(
  BIT_SIDE_NAV_DISK,
  "side-nav-collapse-preference",
  { deserializer: (s) => s },
);

describe("SideNavService", () => {
  let stateProvider: StorybookGlobalStateProvider;

  const setup = (seed?: (stateProvider: StorybookGlobalStateProvider) => void) => {
    stateProvider = new StorybookGlobalStateProvider();
    seed?.(stateProvider);

    TestBed.configureTestingModule({
      providers: [{ provide: GlobalStateProvider, useValue: stateProvider }],
    });

    return TestBed.inject(SideNavService);
  };

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it("defaults to closed with no preference when nothing is persisted", () => {
    const service = setup();

    expect(service.open()).toBe(false);
    expect(service.userCollapsePreference()).toBeNull();
  });

  it("persists closed when the user hides an open nav", async () => {
    const service = setup();
    service.open.set(true);

    service.toggle();

    expect(service.open()).toBe(false);
    expect(service.userCollapsePreference()).toBe("closed");
    await expect(firstValueFrom(stateProvider.get(collapsePreferenceKeyDef).state$)).resolves.toBe(
      "closed",
    );
  });

  it("persists open when the user shows a previously-hidden nav", () => {
    const service = setup();
    service.open.set(true);
    service.toggle(); // closed
    service.toggle(); // open again

    expect(service.open()).toBe(true);
    expect(service.userCollapsePreference()).toBe("open");
  });

  it("restores a persisted closed preference on init", () => {
    const service = setup((provider) => provider.get(collapsePreferenceKeyDef).setValue("closed"));

    expect(service.userCollapsePreference()).toBe("closed");
    expect(service.open()).toBe(false);
  });

  it("restores a persisted open preference on init", () => {
    const service = setup((provider) => provider.get(collapsePreferenceKeyDef).setValue("open"));

    expect(service.userCollapsePreference()).toBe("open");
    expect(service.open()).toBe(true);
  });

  it("leaves default behavior untouched when the stored preference is missing", () => {
    // No setValue call — state stays at its default `null`.
    const service = setup();

    expect(service.userCollapsePreference()).toBeNull();
    expect(service.open()).toBe(false);
  });

  it("does not throw and falls back to closed when the stored value is malformed", () => {
    let service: SideNavService;
    expect(
      () =>
        (service = setup((provider) =>
          provider.get(collapsePreferenceKeyDef).setValue("not-a-valid-preference" as never),
        )),
    ).not.toThrow();
    expect(service!.open()).toBe(false);
  });
});
