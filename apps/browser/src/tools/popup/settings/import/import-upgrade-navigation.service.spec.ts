import { TestBed } from "@angular/core/testing";

import { BrowserApi } from "../../../../platform/browser/browser-api";

import { ImportUpgradeNavigationService } from "./import-upgrade-navigation.service";

describe("ImportUpgradeNavigationService", () => {
  let service: ImportUpgradeNavigationService;

  beforeEach(() => {
    TestBed.configureTestingModule({});

    service = TestBed.inject(ImportUpgradeNavigationService);
    jest
      .spyOn(BrowserApi, "getRuntimeURL")
      .mockImplementation((path: string) => `chrome-extension://test-extension-id/${path}`);
    jest.spyOn(BrowserApi, "createNewTab").mockResolvedValue({} as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("openImportSourceSelectTab", () => {
    it("opens the extension's own import picker route in a new tab immediately, with no confirmation, marked as a tab (not a popup)", async () => {
      await service.openImportSourceSelectTab();

      expect(BrowserApi.createNewTab).toHaveBeenCalledWith(
        "chrome-extension://test-extension-id/popup/index.html?uilocation=tab#/import-source-select",
      );
    });
  });
});
