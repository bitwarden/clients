import { createChromeTabMock } from "../../autofill/spec/autofill-mocks";

import { BrowserApi } from "./browser-api";
import BrowserPopupUtils from "./browser-popup-utils";

describe("BrowserPopupUtils", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("inSidebar", () => {
    it("should return true if the window contains the sidebar query param", () => {
      const win = { location: { href: "https://jest-testing.com?uilocation=sidebar" } } as Window;

      expect(BrowserPopupUtils.inSidebar(win)).toBe(true);
    });

    it("should return false if the window does not contain the sidebar query param", () => {
      const win = { location: { href: "https://jest-testing.com?uilocation=popout" } } as Window;

      expect(BrowserPopupUtils.inSidebar(win)).toBe(false);
    });
  });

  describe("inPopout", () => {
    it("should return true if the window contains the popout query param", () => {
      const win = { location: { href: "https://jest-testing.com?uilocation=popout" } } as Window;

      expect(BrowserPopupUtils.inPopout(win)).toBe(true);
    });

    it("should return false if the window does not contain the popout query param", () => {
      const win = { location: { href: "https://jest-testing.com?uilocation=sidebar" } } as Window;

      expect(BrowserPopupUtils.inPopout(win)).toBe(false);
    });
  });

  describe("inSingleActionPopout", () => {
    it("should return true if the window contains the singleActionPopout query param", () => {
      const win = {
        location: { href: "https://jest-testing.com?singleActionPopout=123" },
      } as Window;

      expect(BrowserPopupUtils.inSingleActionPopout(win, "123")).toBe(true);
    });

    it("should return false if the window does not contain the singleActionPopout query param", () => {
      const win = { location: { href: "https://jest-testing.com" } } as Window;

      expect(BrowserPopupUtils.inSingleActionPopout(win, "123")).toBe(false);
    });
  });

  describe("inPopup", () => {
    it("should return true if the window does not contain the popup query param", () => {
      const win = { location: { href: "https://jest-testing.com" } } as Window;

      expect(BrowserPopupUtils.inPopup(win)).toBe(true);
    });

    it("should return true if the window contains the popup query param", () => {
      const win = { location: { href: "https://jest-testing.com?uilocation=popup" } } as Window;

      expect(BrowserPopupUtils.inPopup(win)).toBe(true);
    });

    it("should return false if the window does not contain the popup query param", () => {
      const win = { location: { href: "https://jest-testing.com?uilocation=sidebar" } } as Window;

      expect(BrowserPopupUtils.inPopup(win)).toBe(false);
    });
  });

  describe("getContentScrollY", () => {
    it("should return the scroll position of the popup", () => {
      const win = {
        document: { getElementsByTagName: () => [{ scrollTop: 100 }] },
      } as unknown as Window;

      expect(BrowserPopupUtils.getContentScrollY(win)).toBe(100);
    });
  });

  describe("setContentScrollY", () => {
    it("should set the scroll position of the popup", async () => {
      window.document.body.innerHTML = `
        <main>
          <div></div>
        </main>
      `;

      await BrowserPopupUtils.setContentScrollY(window, 200);

      expect(window.document.getElementsByTagName("main")[0].scrollTop).toBe(200);
    });

    it("should not set the scroll position of the popup if the scrollY is null", async () => {
      window.document.body.innerHTML = `
        <main>
          <div></div>
        </main>
      `;

      await BrowserPopupUtils.setContentScrollY(window, null);

      expect(window.document.getElementsByTagName("main")[0].scrollTop).toBe(0);
    });

    it("will set the scroll position of the popup after the provided delay", async () => {
      jest.useRealTimers();
      window.document.body.innerHTML = `
        <div class="scrolling-container">
          <div></div>
        </div>
      `;

      await BrowserPopupUtils.setContentScrollY(window, 300, {
        delay: 200,
        containerSelector: ".scrolling-container",
      });

      expect(window.document.querySelector(".scrolling-container").scrollTop).toBe(300);
    });
  });

  describe("backgroundInitializationRequired", () => {
    it("return true if the background page is a null value", () => {
      jest.spyOn(BrowserApi, "getBackgroundPage").mockReturnValue(null);

      expect(BrowserPopupUtils.backgroundInitializationRequired()).toBe(true);
    });

    it("return false if the background page is not a null value", () => {
      jest.spyOn(BrowserApi, "getBackgroundPage").mockReturnValue({});

      expect(BrowserPopupUtils.backgroundInitializationRequired()).toBe(false);
    });
  });

  describe("openPopout", () => {
    beforeEach(() => {
      jest.spyOn(BrowserApi, "getPlatformInfo").mockResolvedValueOnce({
        os: "linux",
        arch: "x86-64",
        nacl_arch: "x86-64",
      });
      jest.spyOn(BrowserApi, "getWindow").mockResolvedValueOnce({
        id: 1,
        left: 100,
        top: 100,
        focused: false,
        alwaysOnTop: false,
        incognito: false,
        width: 380,
      });
      jest.spyOn(BrowserApi, "createWindow").mockImplementation();
      jest.spyOn(BrowserApi, "updateWindowProperties").mockImplementation();
      jest.spyOn(BrowserApi, "getPlatformInfo").mockImplementation();
    });

    it("creates a window with the default window options", async () => {
      const url = "popup/index.html";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(false);

      await BrowserPopupUtils.openPopout(url);

      expect(BrowserApi.createWindow).toHaveBeenCalledWith({
        type: "popup",
        focused: true,
        width: 380,
        height: 630,
        left: 85,
        top: 190,
        url: `chrome-extension://id/${url}?uilocation=popout`,
      });
    });

    it("skips parsing the passed extension url path if the option to do that is set", () => {
      const url = "popup/index.html?uilocation=popout#/tabs/vault";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(false);
      jest.spyOn(BrowserPopupUtils as any, "buildPopoutUrl");

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserPopupUtils.openPopout(url);

      expect(BrowserPopupUtils["buildPopoutUrl"]).not.toHaveBeenCalled();
    });

    it("replaces any existing `uilocation=` query params within the passed extension url path to state the uilocation is a popup", async () => {
      const url = "popup/index.html?uilocation=sidebar#/tabs/vault";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(false);

      await BrowserPopupUtils.openPopout(url);

      expect(BrowserApi.createWindow).toHaveBeenCalledWith({
        type: "popup",
        focused: true,
        width: 380,
        height: 630,
        left: 85,
        top: 190,
        url: `chrome-extension://id/popup/index.html?uilocation=popout#/tabs/vault`,
      });
    });

    it("creates a single action popout window", async () => {
      const url = "popup/index.html";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(false);

      await BrowserPopupUtils.openPopout(url, { singleActionKey: "123" });

      expect(BrowserApi.createWindow).toHaveBeenCalledWith({
        type: "popup",
        focused: true,
        width: 380,
        height: 630,
        left: 85,
        top: 190,
        url: `chrome-extension://id/${url}?uilocation=popout&singleActionPopout=123`,
      });
    });

    it("does not create a single action popout window if it is already open", async () => {
      const url = "popup/index.html";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(true);

      await BrowserPopupUtils.openPopout(url, { singleActionKey: "123" });

      expect(BrowserApi.createWindow).not.toHaveBeenCalled();
    });

    it("creates a window with the provided window options", async () => {
      const url = "popup/index.html";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(false);

      await BrowserPopupUtils.openPopout(url, {
        windowOptions: {
          type: "popup",
          focused: false,
          width: 100,
          height: 100,
        },
      });

      expect(BrowserApi.createWindow).toHaveBeenCalledWith({
        type: "popup",
        focused: false,
        width: 100,
        height: 100,
        left: 85,
        top: 190,
        url: `chrome-extension://id/${url}?uilocation=popout`,
      });
    });

    it("opens a single action window if the forceCloseExistingWindows param is true", async () => {
      const url = "popup/index.html";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(true);

      await BrowserPopupUtils.openPopout(url, {
        singleActionKey: "123",
        forceCloseExistingWindows: true,
      });

      expect(BrowserApi.createWindow).toHaveBeenCalledWith({
        type: "popup",
        focused: true,
        width: 380,
        height: 630,
        left: 85,
        top: 190,
        url: `chrome-extension://id/${url}?uilocation=popout&singleActionPopout=123`,
      });
    });

    it("exits fullscreen and focuses popout window if the current window is fullscreen and platform is mac", async () => {
      const url = "popup/index.html";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(false);
      jest.spyOn(BrowserApi, "getPlatformInfo").mockReset().mockResolvedValueOnce({
        os: "mac",
        arch: "x86-64",
        nacl_arch: "x86-64",
      });
      jest.spyOn(BrowserApi, "getWindow").mockReset().mockResolvedValueOnce({
        id: 1,
        left: 100,
        top: 100,
        focused: false,
        alwaysOnTop: false,
        incognito: false,
        width: 380,
        state: "fullscreen",
      });
      jest
        .spyOn(BrowserApi, "createWindow")
        .mockResolvedValueOnce({ id: 2 } as chrome.windows.Window);

      await BrowserPopupUtils.openPopout(url, { senderWindowId: 1 });
      expect(BrowserApi.updateWindowProperties).toHaveBeenCalledWith(1, {
        state: "maximized",
      });
      expect(BrowserApi.updateWindowProperties).toHaveBeenCalledWith(2, {
        focused: true,
      });
    });

    it("doesnt exit fullscreen if the platform is not mac", async () => {
      const url = "popup/index.html";
      jest.spyOn(BrowserPopupUtils as any, "isSingleActionPopoutOpen").mockResolvedValueOnce(false);
      jest.spyOn(BrowserApi, "getPlatformInfo").mockReset().mockResolvedValueOnce({
        os: "win",
        arch: "x86-64",
        nacl_arch: "x86-64",
      });
      jest.spyOn(BrowserApi, "getWindow").mockResolvedValueOnce({
        id: 1,
        left: 100,
        top: 100,
        focused: false,
        alwaysOnTop: false,
        incognito: false,
        width: 380,
        state: "fullscreen",
      });

      await BrowserPopupUtils.openPopout(url);

      expect(BrowserApi.updateWindowProperties).not.toHaveBeenCalledWith(1, {
        state: "maximized",
      });
    });
  });

  describe("openCurrentPagePopout", () => {
    it("opens a popout window for the current page", async () => {
      const win = { location: { href: "https://example.com#/tabs/current" } } as Window;
      jest.spyOn(BrowserPopupUtils, "openPopout").mockImplementation();
      jest.spyOn(BrowserApi, "closePopup").mockImplementation();
      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(false);

      await BrowserPopupUtils.openCurrentPagePopout(win);

      expect(BrowserPopupUtils.openPopout).toHaveBeenCalledWith("/#/tabs/vault");
      expect(BrowserApi.closePopup).not.toHaveBeenCalled();
    });

    it("opens a popout window for the specified URL", async () => {
      const win = {} as Window;
      jest.spyOn(BrowserPopupUtils, "openPopout").mockImplementation();
      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(false);

      await BrowserPopupUtils.openCurrentPagePopout(win, "https://example.com#/settings");

      expect(BrowserPopupUtils.openPopout).toHaveBeenCalledWith("/#/settings");
    });

    it("opens a popout window for the current page and closes the popup window", async () => {
      const win = { location: { href: "https://example.com/#/tabs/vault" } } as Window;
      jest.spyOn(BrowserPopupUtils, "openPopout").mockImplementation();
      jest.spyOn(BrowserApi, "closePopup").mockImplementation();
      jest.spyOn(BrowserPopupUtils, "inPopup").mockReturnValue(true);

      await BrowserPopupUtils.openCurrentPagePopout(win);

      expect(BrowserPopupUtils.openPopout).toHaveBeenCalledWith("/#/tabs/vault");
      expect(BrowserApi.closePopup).toHaveBeenCalledWith(win);
    });
  });

  describe("closeSingleActionPopout", () => {
    it("closes any existing single action popouts", async () => {
      const url = "popup/index.html";
      jest.useFakeTimers();
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValueOnce([
        createChromeTabMock({
          id: 10,
          url: `chrome-extension://id/${url}?uilocation=popout&singleActionPopout=123`,
          windowId: 11,
        }),
        createChromeTabMock({
          id: 20,
          url: `chrome-extension://id/${url}?uilocation=popout&singleActionPopout=123`,
          windowId: 21,
        }),
        createChromeTabMock({
          id: 30,
          url: `chrome-extension://id/${url}?uilocation=popout&singleActionPopout=456`,
          windowId: 31,
        }),
      ]);
      jest.spyOn(BrowserApi, "removeWindow").mockResolvedValueOnce();

      await BrowserPopupUtils.closeSingleActionPopout("123");
      jest.runOnlyPendingTimers();

      expect(BrowserApi.removeWindow).toHaveBeenNthCalledWith(1, 11);
      expect(BrowserApi.removeWindow).toHaveBeenNthCalledWith(2, 21);
      expect(BrowserApi.removeWindow).not.toHaveBeenCalledWith(31);
    });
  });

  describe("waitForAllPopupsClose", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should resolve immediately if no popups are open", async () => {
      jest.spyOn(BrowserApi, "isPopupOpen").mockResolvedValue(false);

      const promise = BrowserPopupUtils.waitForAllPopupsClose();
      jest.advanceTimersByTime(100);

      await expect(promise).resolves.toBeUndefined();
      expect(BrowserApi.isPopupOpen).toHaveBeenCalledTimes(1);
    });

    it("should resolve after timeout if popup never closes when using custom timeout", async () => {
      jest.spyOn(BrowserApi, "isPopupOpen").mockResolvedValue(true);

      const promise = BrowserPopupUtils.waitForAllPopupsClose(500);

      // Advance past the timeout
      jest.advanceTimersByTime(600);

      await expect(promise).resolves.toBeUndefined();
    });

    it("should resolve after timeout if popup never closes when using default timeout", async () => {
      jest.spyOn(BrowserApi, "isPopupOpen").mockResolvedValue(true);

      const promise = BrowserPopupUtils.waitForAllPopupsClose();

      // Advance past the default timeout
      jest.advanceTimersByTime(1100);

      await expect(promise).resolves.toBeUndefined();
    });

    it("should stop polling after popup closes before timeout", async () => {
      let callCount = 0;
      jest.spyOn(BrowserApi, "isPopupOpen").mockImplementation(async () => {
        callCount++;
        return callCount <= 2;
      });

      const promise = BrowserPopupUtils.waitForAllPopupsClose(1000);

      // Advance to when popup closes (300ms)
      jest.advanceTimersByTime(300);

      await expect(promise).resolves.toBeUndefined();

      // Advance further to ensure no more calls are made
      jest.advanceTimersByTime(1000);

      expect(BrowserApi.isPopupOpen).toHaveBeenCalledTimes(3);
    });
  });

  describe("isSingleActionPopoutOpen", () => {
    const windowOptions = {
      id: 1,
      left: 100,
      top: 100,
      focused: false,
      alwaysOnTop: false,
      incognito: false,
      width: 500,
      height: 800,
    };

    beforeEach(() => {
      jest.spyOn(BrowserApi, "updateWindowProperties").mockImplementation();
      jest.spyOn(BrowserApi, "removeWindow").mockImplementation();
    });

    it("returns false if the popoutKey is not provided", async () => {
      await expect(BrowserPopupUtils["isSingleActionPopoutOpen"](undefined, {})).resolves.toBe(
        false,
      );
    });

    it("returns false if no popout windows are found", async () => {
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValueOnce([]);

      await expect(
        BrowserPopupUtils["isSingleActionPopoutOpen"]("123", windowOptions),
      ).resolves.toBe(false);
    });

    it("returns false if no single action popout is found relating to the popoutKey", async () => {
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValueOnce([
        createChromeTabMock({
          id: 10,
          url: `chrome-extension://id/popup/index.html?uilocation=popout&singleActionPopout=123`,
        }),
        createChromeTabMock({
          id: 20,
          url: `chrome-extension://id/popup/index.html?uilocation=popout&singleActionPopout=123`,
        }),
        createChromeTabMock({
          id: 30,
          url: `chrome-extension://id/popup/index.html?uilocation=popout&singleActionPopout=456`,
        }),
      ]);

      await expect(
        BrowserPopupUtils["isSingleActionPopoutOpen"]("789", windowOptions),
      ).resolves.toBe(false);
    });

    it("returns true if a single action popout is found relating to the popoutKey", async () => {
      jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValueOnce([
        createChromeTabMock({
          id: 10,
          url: `chrome-extension://id/popup/index.html?uilocation=popout&singleActionPopout=123`,
        }),
        createChromeTabMock({
          id: 20,
          url: `chrome-extension://id/popup/index.html?uilocation=popout&singleActionPopout=123`,
        }),
        createChromeTabMock({
          id: 30,
          url: `chrome-extension://id/popup/index.html?uilocation=popout&singleActionPopout=456`,
        }),
      ]);

      await expect(
        BrowserPopupUtils["isSingleActionPopoutOpen"]("123", windowOptions),
      ).resolves.toBe(true);
      expect(BrowserApi.updateWindowProperties).toHaveBeenCalledWith(2, {
        focused: true,
        width: 500,
        height: 800,
        top: 100,
        left: 100,
      });
      expect(BrowserApi.removeWindow).toHaveBeenCalledTimes(1);
    });
  });
});
