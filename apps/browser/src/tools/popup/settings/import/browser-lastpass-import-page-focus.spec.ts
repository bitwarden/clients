import { BrowserApi } from "../../../../platform/browser/browser-api";

import { BrowserLastPassImportPageFocus } from "./browser-lastpass-import-page-focus";

describe("BrowserLastPassImportPageFocus", () => {
  let pageFocus: BrowserLastPassImportPageFocus;
  let getCurrentTab: jest.SpyInstance;
  let focusWindow: jest.SpyInstance;
  let focusTab: jest.SpyInstance;

  const flush = () => new Promise((resolve) => setTimeout(resolve));

  beforeEach(() => {
    pageFocus = new BrowserLastPassImportPageFocus();
    getCurrentTab = jest.spyOn(BrowserApi, "getCurrentTab");
    focusWindow = jest.spyOn(BrowserApi, "focusWindow").mockResolvedValue(undefined);
    focusTab = jest.spyOn(BrowserApi, "focusTab").mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("refocuses the captured tab's window, then the tab", async () => {
    getCurrentTab.mockResolvedValue({ id: 7, windowId: 3 } as chrome.tabs.Tab);

    await pageFocus.capture();
    pageFocus.restore();
    await flush();

    expect(focusWindow).toHaveBeenCalledWith(3);
    expect(focusTab).toHaveBeenCalledWith(7);
    expect(focusWindow.mock.invocationCallOrder[0]).toBeLessThan(
      focusTab.mock.invocationCallOrder[0],
    );
  });

  it("refocuses once per capture", async () => {
    getCurrentTab.mockResolvedValue({ id: 7, windowId: 3 } as chrome.tabs.Tab);

    await pageFocus.capture();
    pageFocus.restore();
    pageFocus.restore();
    await flush();

    expect(focusTab).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no page was captured", async () => {
    pageFocus.restore();
    await flush();

    expect(focusWindow).not.toHaveBeenCalled();
    expect(focusTab).not.toHaveBeenCalled();
  });

  it("does nothing when the current tab can't be determined", async () => {
    getCurrentTab.mockResolvedValue(undefined as unknown as chrome.tabs.Tab);

    await pageFocus.capture();
    pageFocus.restore();
    await flush();

    expect(focusTab).not.toHaveBeenCalled();
  });

  it("does not let a failed capture block the login", async () => {
    getCurrentTab.mockRejectedValue(new Error("no tabs API"));

    await expect(pageFocus.capture()).resolves.toBeUndefined();
    pageFocus.restore();
    await flush();

    expect(focusTab).not.toHaveBeenCalled();
  });

  it("swallows a focus failure", async () => {
    getCurrentTab.mockResolvedValue({ id: 7, windowId: 3 } as chrome.tabs.Tab);
    focusWindow.mockRejectedValue(new Error("window closed"));

    await pageFocus.capture();

    expect(() => pageFocus.restore()).not.toThrow();
    await flush();
  });
});
