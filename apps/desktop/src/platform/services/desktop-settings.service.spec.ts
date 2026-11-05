import { firstValueFrom } from "rxjs";

import { FakeAccountService, FakeStateProvider } from "@bitwarden/common/spec";

import { isDev } from "../../utils";

import { DesktopSettingsService } from "./desktop-settings.service";

jest.mock("../../utils", () => ({
  isDev: jest.fn(),
}));

describe("DesktopSettingsService", () => {
  let stateProvider: FakeStateProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    const accountService = new FakeAccountService({});
    stateProvider = new FakeStateProvider(accountService);
  });

  describe("openAtLogin$", () => {
    it("emits false for unset state on Mac App Store builds", async () => {
      const service = new DesktopSettingsService(stateProvider, true);

      expect(await firstValueFrom(service.openAtLogin$)).toBe(false);
    });

    it("emits true for unset state when not a Mac App Store build and not in development", async () => {
      (isDev as jest.Mock).mockReturnValue(false);
      const service = new DesktopSettingsService(stateProvider, false);

      expect(await firstValueFrom(service.openAtLogin$)).toBe(true);
    });

    it.each([
      { isMacAppStore: true, stored: true },
      { isMacAppStore: false, stored: true },
      { isMacAppStore: true, stored: false },
      { isMacAppStore: false, stored: false },
    ])(
      "returns the stored value ($stored) as-is when isMacAppStore is $isMacAppStore",
      async ({ isMacAppStore, stored }) => {
        const service = new DesktopSettingsService(stateProvider, isMacAppStore);
        await service.setOpenAtLogin(stored);

        expect(await firstValueFrom(service.openAtLogin$)).toBe(stored);
      },
    );
  });
});
