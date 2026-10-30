import { firstValueFrom } from "rxjs";

import { FakeGlobalStateProvider } from "@bitwarden/common/spec";

import { flushPromises } from "../../autofill/spec/testing-utils";
import { BrowserApi } from "../browser/browser-api";

import { SIDE_PANEL_PATH, SidePanelSettingsService } from "./side-panel-settings.service";

describe("SidePanelSettingsService", () => {
  let globalStateProvider: FakeGlobalStateProvider;
  let service: SidePanelSettingsService;
  let setSidePanelOptions: jest.SpyInstance;
  let setSidePanelBehavior: jest.SpyInstance;

  beforeEach(() => {
    globalStateProvider = new FakeGlobalStateProvider();
    service = new SidePanelSettingsService(globalStateProvider);
    jest.spyOn(BrowserApi, "isSidePanelApiSupported", "get").mockReturnValue(true);
    setSidePanelOptions = jest.spyOn(BrowserApi, "setSidePanelOptions").mockResolvedValue();
    setSidePanelBehavior = jest.spyOn(BrowserApi, "setSidePanelBehavior").mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("defaults to the popup", async () => {
    expect(await firstValueFrom(service.openInSidePanel$)).toBe(false);
  });

  it("persists the setting", async () => {
    await service.setOpenInSidePanel(true);

    expect(await firstValueFrom(service.openInSidePanel$)).toBe(true);
  });

  describe("applyToBrowser", () => {
    it("keeps the side panel disabled by default", async () => {
      service.applyToBrowser();
      await flushPromises();

      expect(setSidePanelOptions).toHaveBeenCalledWith({ enabled: false });
      expect(setSidePanelBehavior).toHaveBeenCalledWith({ openPanelOnActionClick: false });
    });

    it("opens the side panel on action click when enabled", async () => {
      service.applyToBrowser();
      await service.setOpenInSidePanel(true);
      await flushPromises();

      expect(setSidePanelOptions).toHaveBeenLastCalledWith({
        path: SIDE_PANEL_PATH,
        enabled: true,
      });
      expect(setSidePanelBehavior).toHaveBeenLastCalledWith({ openPanelOnActionClick: true });
    });

    it("does nothing when the side panel API is not supported", async () => {
      jest.spyOn(BrowserApi, "isSidePanelApiSupported", "get").mockReturnValue(false);

      expect(service.applyToBrowser()).toBeUndefined();
      expect(setSidePanelOptions).not.toHaveBeenCalled();
    });
  });
});
