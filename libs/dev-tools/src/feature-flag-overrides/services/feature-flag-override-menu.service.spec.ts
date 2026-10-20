import { mock, MockProxy } from "jest-mock-extended";
import { firstValueFrom } from "rxjs";

import { FakeStateProvider, mockAccountServiceWith } from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import { CenterPositionStrategy, DialogService } from "@bitwarden/components";

import { FeatureFlagOverridesDialogComponent } from "../feature-flag-overrides-dialog/feature-flag-overrides-dialog.component";

import { FeatureFlagOverrideMenuService } from "./feature-flag-override-menu.service";

describe("FeatureFlagOverrideMenuService", () => {
  let stateProvider: FakeStateProvider;
  let dialogService: MockProxy<DialogService>;

  const build = (defaultEnabled: boolean) =>
    new FeatureFlagOverrideMenuService(stateProvider, dialogService, defaultEnabled);

  beforeEach(() => {
    stateProvider = new FakeStateProvider(mockAccountServiceWith("user-id" as UserId));
    dialogService = mock<DialogService>();
    delete (globalThis as Record<string, unknown>).featureFlagMenu;
  });

  describe("enabled$", () => {
    it.each([
      { defaultEnabled: true, toggled: false, expected: true },
      { defaultEnabled: true, toggled: true, expected: true },
      { defaultEnabled: false, toggled: false, expected: false },
      { defaultEnabled: false, toggled: true, expected: true },
    ])(
      "is $expected when default is $defaultEnabled and toggled is $toggled",
      async ({ defaultEnabled, toggled, expected }) => {
        const sut = build(defaultEnabled);
        if (toggled) {
          await sut.toggle();
        }

        expect(await firstValueFrom(sut.enabled$)).toBe(expected);
      },
    );

    it("persists the toggle across service instances", async () => {
      await build(false).toggle();

      expect(await firstValueFrom(build(false).enabled$)).toBe(true);
    });
  });

  describe("toggle", () => {
    it("returns true in a development build regardless of the stored choice", async () => {
      const sut = build(true);

      expect(await sut.toggle()).toBe(true);
      expect(await sut.toggle()).toBe(true);
    });

    it("flips the stored choice and returns it", async () => {
      const sut = build(false);

      expect(await sut.toggle()).toBe(true);
      expect(await sut.toggle()).toBe(false);
    });
  });

  describe("openDialog", () => {
    it("opens the overrides dialog", () => {
      build(true).openDialog();

      expect(dialogService.open).toHaveBeenCalledWith(FeatureFlagOverridesDialogComponent, {
        positionStrategy: expect.any(CenterPositionStrategy),
      });
    });
  });

  describe("installGlobalHook", () => {
    it("does not define the hook until installed", () => {
      build(false);

      expect(globalThis.featureFlagMenu).toBeUndefined();
    });

    it("toggles the menu via the global hook", async () => {
      const sut = build(false);
      sut.installGlobalHook();

      await globalThis.featureFlagMenu();

      expect(await firstValueFrom(sut.enabled$)).toBe(true);
    });
  });
});
