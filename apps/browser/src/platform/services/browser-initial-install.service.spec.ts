import { mock } from "jest-mock-extended";
import { of } from "rxjs";

import { devFlagEnabled } from "@bitwarden/common/platform/misc/flags";
import { GlobalState, StateProvider } from "@bitwarden/common/platform/state";

import { BrowserApi } from "../browser/browser-api";
import { ExtensionInstallType } from "../browser/extension-install-type";

import BrowserInitialInstallService from "./browser-initial-install.service";

jest.mock("@bitwarden/common/platform/misc/flags", () => ({
  ...jest.requireActual("@bitwarden/common/platform/misc/flags"),
  devFlagEnabled: jest.fn(),
}));

describe("BrowserInitialInstallService", () => {
  let service: BrowserInitialInstallService;
  let getInstallTypeSpy: jest.SpyInstance;
  let createNewTabSpy: jest.SpyInstance;
  const devFlagEnabledMock = devFlagEnabled as jest.Mock;

  beforeEach(() => {
    const stateProvider = mock<StateProvider>();
    const globalState = mock<GlobalState<boolean>>();
    Object.defineProperty(globalState, "state$", { value: of(false) });
    stateProvider.getGlobal.mockReturnValue(globalState);

    getInstallTypeSpy = jest.spyOn(BrowserApi, "getInstallType");
    createNewTabSpy = jest.spyOn(BrowserApi, "createNewTab").mockResolvedValue({} as any);
    devFlagEnabledMock.mockReturnValue(false);

    service = new BrowserInitialInstallService(stateProvider);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("displayWelcomePage", () => {
    it.each([
      ["Normal", ExtensionInstallType.Normal],
      ["Development", ExtensionInstallType.Development],
      ["Unknown", ExtensionInstallType.Unknown],
    ])("opens the welcome page for %s installs", async (_, installType) => {
      getInstallTypeSpy.mockResolvedValue(installType);

      await service.displayWelcomePage();

      expect(createNewTabSpy).toHaveBeenCalledTimes(1);
      expect(createNewTabSpy).toHaveBeenCalledWith("https://bitwarden.com/browser-start/");
    });

    it.each([
      ["Admin", ExtensionInstallType.Admin],
      ["Sideload", ExtensionInstallType.Sideload],
      ["Other", ExtensionInstallType.Other],
    ])("does not open the welcome page for %s installs", async (_, installType) => {
      getInstallTypeSpy.mockResolvedValue(installType);

      await service.displayWelcomePage();

      expect(createNewTabSpy).not.toHaveBeenCalled();
    });

    it.each([
      ["Normal", ExtensionInstallType.Normal],
      ["Development", ExtensionInstallType.Development],
      ["Unknown", ExtensionInstallType.Unknown],
    ])(
      "does not open the welcome page for %s installs when the skipWelcomeOnInstall dev flag is on",
      async (_, installType) => {
        getInstallTypeSpy.mockResolvedValue(installType);
        devFlagEnabledMock.mockImplementation((flag) => flag === "skipWelcomeOnInstall");

        await service.displayWelcomePage();

        expect(createNewTabSpy).not.toHaveBeenCalled();
      },
    );

    it("checks the skipWelcomeOnInstall dev flag", async () => {
      getInstallTypeSpy.mockResolvedValue(ExtensionInstallType.Normal);

      await service.displayWelcomePage();

      expect(devFlagEnabledMock).toHaveBeenCalledWith("skipWelcomeOnInstall");
    });
  });
});
