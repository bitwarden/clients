import { createChromeTabMock } from "../../autofill/spec/autofill-mocks";
import { BrowserApi } from "../browser/browser-api";

import { IpcContentScriptManagerService } from "./ipc-content-script-manager.service";

describe("IpcContentScriptManagerService", () => {
  let service: IpcContentScriptManagerService;

  beforeEach(() => {
    jest.spyOn(BrowserApi, "isManifestVersion").mockReturnValue(true);
    jest.spyOn(BrowserApi, "unregisterContentScriptsMv3").mockResolvedValue();
    jest.spyOn(BrowserApi, "registerContentScriptsMv3").mockResolvedValue();
    jest
      .spyOn(BrowserApi, "tabsQuery")
      .mockResolvedValue([createChromeTabMock({ id: 1 }), createChromeTabMock({ id: 2 })]);
    jest.spyOn(BrowserApi, "executeScriptInTab").mockResolvedValue(undefined);

    service = new IpcContentScriptManagerService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("re-injects the content script into open tabs", async () => {
    await service.init();

    expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(1, {
      file: "content/ipc-content-script.js",
      runAt: "document_start",
    });
    expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(2, {
      file: "content/ipc-content-script.js",
      runAt: "document_start",
    });
  });

  it("does not wait for a tab that never responds", async () => {
    // Tab 1 never responds.
    jest.spyOn(BrowserApi, "executeScriptInTab").mockReturnValueOnce(new Promise(() => {}));

    await service.init();

    expect(BrowserApi.executeScriptInTab).toHaveBeenCalledWith(2, expect.anything());
  });
});
