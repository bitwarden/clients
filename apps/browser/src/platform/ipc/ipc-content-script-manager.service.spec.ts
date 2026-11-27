import { BrowserApi } from "../browser/browser-api";

import { IpcContentScriptManagerService } from "./ipc-content-script-manager.service";

jest.mock("../browser/browser-api", () => ({
  BrowserApi: {
    isManifestVersion: jest.fn(),
    unregisterContentScriptsMv3: jest.fn(),
    registerContentScriptsMv3: jest.fn(),
    tabsQuery: jest.fn(),
    executeScriptInTab: jest.fn(),
  },
}));

const browserApi = BrowserApi as jest.Mocked<typeof BrowserApi>;

const tabs = (...ids: number[]) => ids.map((id) => ({ id }) as chrome.tabs.Tab);

describe("IpcContentScriptManagerService", () => {
  let service: IpcContentScriptManagerService;

  beforeEach(() => {
    jest.clearAllMocks();

    browserApi.isManifestVersion.mockReturnValue(true);
    browserApi.unregisterContentScriptsMv3.mockResolvedValue(undefined);
    browserApi.registerContentScriptsMv3.mockResolvedValue(undefined);
    browserApi.tabsQuery.mockResolvedValue([]);
    browserApi.executeScriptInTab.mockResolvedValue(undefined);

    service = new IpcContentScriptManagerService();
  });

  it("registers the content script and re-injects it into open tabs", async () => {
    browserApi.tabsQuery.mockResolvedValue(tabs(1, 2));

    await service.init();

    expect(browserApi.registerContentScriptsMv3).toHaveBeenCalledTimes(1);
    expect(browserApi.executeScriptInTab).toHaveBeenCalledTimes(2);
    expect(browserApi.executeScriptInTab).toHaveBeenCalledWith(1, {
      file: "content/ipc-content-script.js",
      runAt: "document_start",
    });
    expect(browserApi.executeScriptInTab).toHaveBeenCalledWith(2, {
      file: "content/ipc-content-script.js",
      runAt: "document_start",
    });
  });

  it("resolves init without waiting for a tab that never answers", async () => {
    browserApi.tabsQuery.mockResolvedValue(tabs(1, 2));
    // Tab 1 never settles, like a busy tab or one blocked by a dialog.
    browserApi.executeScriptInTab.mockImplementation((tabId) =>
      tabId === 1 ? new Promise(() => {}) : Promise.resolve(undefined),
    );

    // On the old code this await never returns, so the test fails on Jest's timeout.
    await service.init();

    expect(browserApi.executeScriptInTab).toHaveBeenCalledWith(2, expect.anything());
  });
});
