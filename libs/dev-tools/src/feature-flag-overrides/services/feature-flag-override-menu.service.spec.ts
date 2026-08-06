import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";

import { FeatureFlagOverrideMenuService } from "./feature-flag-override-menu.service";

describe("FeatureFlagOverrideMenuService", () => {
  let stateProvider: FakeStateProvider;

  const build = (defaultEnabled: boolean) =>
    new FeatureFlagOverrideMenuService(stateProvider, defaultEnabled);

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));
    delete (globalThis as Record<string, unknown>).enableFeatureFlagOverrideMenu;
    delete (globalThis as Record<string, unknown>).disableFeatureFlagOverrideMenu;
  });

  describe("enabled$", () => {
    it.each([true, false])(
      "falls back to the client default (%s) when no choice has been made",
      async (defaultEnabled) => {
        expect(await firstValueFrom(build(defaultEnabled).enabled$)).toBe(defaultEnabled);
      },
    );

    it("prefers an explicit enable over a default of off", async () => {
      const sut = build(false);

      await sut.setEnabled(true);

      expect(await firstValueFrom(sut.enabled$)).toBe(true);
    });

    it("prefers an explicit disable over a default of on", async () => {
      const sut = build(true);

      await sut.setEnabled(false);

      expect(await firstValueFrom(sut.enabled$)).toBe(false);
    });

    it("persists the choice across service instances", async () => {
      await build(false).setEnabled(true);

      expect(await firstValueFrom(build(false).enabled$)).toBe(true);
    });
  });

  describe("installGlobalHook", () => {
    it("does not define the hooks until installed", () => {
      build(false);

      expect(globalThis.enableFeatureFlagOverrideMenu).toBeUndefined();
    });

    it("enables the menu via the global hook", async () => {
      const sut = build(false);
      sut.installGlobalHook();

      await globalThis.enableFeatureFlagOverrideMenu();

      expect(await firstValueFrom(sut.enabled$)).toBe(true);
    });

    it("disables the menu via the global hook", async () => {
      const sut = build(true);
      sut.installGlobalHook();

      await globalThis.disableFeatureFlagOverrideMenu();

      expect(await firstValueFrom(sut.enabled$)).toBe(false);
    });
  });
});
