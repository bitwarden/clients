import { mock } from "jest-mock-extended";

import { BrowserApi } from "./browser-api";

type ChromeSettingsGet = chrome.types.ChromeSetting<boolean>["get"];

describe("BrowserApi", () => {
  const executeScriptResult = ["value"];

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("isManifestVersion", () => {
    beforeEach(() => {
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(3);
    });

    it("returns true if the manifest version matches the provided version", () => {
      const result = BrowserApi.isManifestVersion(3);

      expect(result).toBe(true);
    });

    it("returns false if the manifest version does not match the provided version", () => {
      const result = BrowserApi.isManifestVersion(2);

      expect(result).toBe(false);
    });
  });

  describe("getWindow", () => {
    it("will get the current window if a window id is not provided", () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.getWindow();

      expect(chrome.windows.getCurrent).toHaveBeenCalledWith({ populate: true }, expect.anything());
    });

    it("will get the window with the provided id if one is provided", () => {
      const windowId = 1;

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.getWindow(windowId);

      expect(chrome.windows.get).toHaveBeenCalledWith(
        windowId,
        { populate: true },
        expect.anything(),
      );
    });
  });

  describe("getCurrentWindow", () => {
    it("will get the current window", () => {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.getCurrentWindow();

      expect(chrome.windows.getCurrent).toHaveBeenCalledWith({ populate: true }, expect.anything());
    });
  });

  describe("getWindowById", () => {
    it("will get the window associated with the passed window id", () => {
      const windowId = 1;

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.getWindowById(windowId);

      expect(chrome.windows.get).toHaveBeenCalledWith(
        windowId,
        { populate: true },
        expect.anything(),
      );
    });
  });

  describe("removeWindow", () => {
    it("removes the window based on the passed window id", () => {
      const windowId = 10;

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.removeWindow(windowId);

      expect(chrome.windows.remove).toHaveBeenCalledWith(windowId, expect.anything());
    });
  });

  describe("updateWindowProperties", () => {
    it("will update the window with the provided window options", () => {
      const windowId = 1;
      const windowOptions: chrome.windows.UpdateInfo = {
        focused: true,
      };

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.updateWindowProperties(windowId, windowOptions);

      expect(chrome.windows.update).toHaveBeenCalledWith(
        windowId,
        windowOptions,
        expect.anything(),
      );
    });
  });

  describe("focusWindow", () => {
    it("will focus the window with the provided window id", () => {
      const windowId = 1;

      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      BrowserApi.focusWindow(windowId);

      expect(chrome.windows.update).toHaveBeenCalledWith(
        windowId,
        { focused: true },
        expect.anything(),
      );
    });
  });

  describe("getTab", () => {
    it("returns `null` if the tabId is a falsy value", async () => {
      const result = await BrowserApi.getTab(null);

      expect(result).toBeNull();
    });

    it("returns the tab within manifest v3", async () => {
      const tabId = 1;
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(3);
      (chrome.tabs.get as jest.Mock).mockImplementation(
        (tabId) => ({ id: tabId }) as chrome.tabs.Tab,
      );

      const result = await BrowserApi.getTab(tabId);

      expect(result).toEqual({ id: tabId });
    });

    it("returns the tab within manifest v2", async () => {
      const tabId = 1;
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(2);
      (chrome.tabs.get as jest.Mock).mockImplementation((tabId, callback) =>
        callback({ id: tabId } as chrome.tabs.Tab),
      );

      const result = BrowserApi.getTab(tabId);

      await expect(result).resolves.toEqual({ id: tabId });
    });
  });

  describe("getBackgroundPage", () => {
    it("returns a null value if the `getBackgroundPage` method is not available", () => {
      chrome.extension.getBackgroundPage = undefined;

      const result = BrowserApi.getBackgroundPage();

      expect(result).toBeNull();
    });

    it("returns the background page if the `getBackgroundPage` method is available", () => {
      chrome.extension.getBackgroundPage = jest.fn().mockReturnValue(window);

      const result = BrowserApi.getBackgroundPage();

      expect(result).toEqual(window);
    });
  });

  describe("isBackgroundPage", () => {
    it("returns false if the passed window is `undefined`", () => {
      const result = BrowserApi.isBackgroundPage(undefined);

      expect(result).toBe(false);
    });

    it("returns false if the current window is not the background page", () => {
      chrome.extension.getBackgroundPage = jest.fn().mockReturnValue(null);

      const result = BrowserApi.isBackgroundPage(window);

      expect(result).toBe(false);
    });

    it("returns true if the current window is the background page", () => {
      chrome.extension.getBackgroundPage = jest.fn().mockReturnValue(window);

      const result = BrowserApi.isBackgroundPage(window);

      expect(result).toBe(true);
    });
  });

  describe("getExtensionViews", () => {
    it("returns an empty array if the `getViews` method is not available", () => {
      chrome.extension.getViews = undefined;

      const result = BrowserApi.getExtensionViews();

      expect(result).toEqual([]);
    });

    it("returns the extension views if the `getViews` method is available", () => {
      const views = [window];
      chrome.extension.getViews = jest.fn().mockReturnValue(views);

      const result = BrowserApi.getExtensionViews();

      expect(result).toEqual(views);
    });
  });

  describe("isPopupOpen", () => {
    it("returns true if the popup is open", async () => {
      chrome.extension.getViews = jest.fn().mockReturnValue([window]);

      const result = await BrowserApi.isPopupOpen();

      expect(result).toBe(true);
    });

    it("returns false if the popup is not open", async () => {
      chrome.extension.getViews = jest.fn().mockReturnValue([]);

      const result = await BrowserApi.isPopupOpen();

      expect(result).toBe(false);
    });
  });

  describe("getFrameDetails", () => {
    it("returns the frame details of the specified frame", async () => {
      const tabId = 1;
      const frameId = 2;
      const mockFrameDetails = mock<chrome.webNavigation.GetFrameResultDetails>();
      chrome.webNavigation.getFrame = jest
        .fn()
        .mockImplementation((_details, callback) => callback(mockFrameDetails));

      const returnFrame = await BrowserApi.getFrameDetails({ tabId, frameId });

      expect(chrome.webNavigation.getFrame).toHaveBeenCalledWith(
        { tabId, frameId },
        expect.any(Function),
      );
      expect(returnFrame).toEqual(mockFrameDetails);
    });
  });

  describe("getAllFrameDetails", () => {
    it("returns all sub frame details of the specified tab", async () => {
      const tabId = 1;
      const mockFrameDetails1 = mock<chrome.webNavigation.GetAllFrameResultDetails>();
      const mockFrameDetails2 = mock<chrome.webNavigation.GetAllFrameResultDetails>();
      chrome.webNavigation.getAllFrames = jest
        .fn()
        .mockImplementation((_details, callback) =>
          callback([mockFrameDetails1, mockFrameDetails2]),
        );

      const frames = await BrowserApi.getAllFrameDetails(tabId);

      expect(chrome.webNavigation.getAllFrames).toHaveBeenCalledWith(
        { tabId },
        expect.any(Function),
      );
      expect(frames).toEqual([mockFrameDetails1, mockFrameDetails2]);
    });
  });

  describe("reloadExtension", () => {
    it("forwards call to extension runtime", () => {
      BrowserApi.reloadExtension();
      expect(chrome.runtime.reload).toHaveBeenCalled();
    });
  });

  describe("reloadOpenWindows", () => {
    const href = window.location.href;
    const reload = window.location.reload;

    afterEach(() => {
      window.location.href = href;
      window.location.reload = reload;
    });

    it("skips reloading any windows if no views can be found", () => {
      Object.defineProperty(window, "location", {
        value: { reload: jest.fn(), href: "chrome-extension://id-value/background.html" },
        writable: true,
      });
      chrome.extension.getViews = jest.fn().mockReturnValue([]);

      BrowserApi.reloadOpenWindows();

      expect(window.location.reload).not.toHaveBeenCalled();
    });

    it("reloads all open windows", () => {
      Object.defineProperty(window, "location", {
        value: { reload: jest.fn(), href: "chrome-extension://id-value/index.html" },
        writable: true,
      });
      const views = [window];
      chrome.extension.getViews = jest.fn().mockReturnValue(views);

      BrowserApi.reloadOpenWindows();

      expect(window.location.reload).toHaveBeenCalledTimes(views.length);
    });

    it("skips reloading the background page", () => {
      Object.defineProperty(window, "location", {
        value: { reload: jest.fn(), href: "chrome-extension://id-value/background.html" },
        writable: true,
      });
      const views = [window];
      chrome.extension.getViews = jest.fn().mockReturnValue(views);
      chrome.extension.getBackgroundPage = jest.fn().mockReturnValue(window);

      BrowserApi.reloadOpenWindows();

      expect(window.location.reload).toHaveBeenCalledTimes(0);
    });

    it("skips reloading the current href if it is exempt", () => {
      Object.defineProperty(window, "location", {
        value: { reload: jest.fn(), href: "chrome-extension://id-value/index.html" },
        writable: true,
      });
      const mockWindow = mock<Window>({
        location: {
          href: "chrome-extension://id-value/sidebar.html",
          reload: jest.fn(),
        },
      });
      const views = [window, mockWindow];
      chrome.extension.getViews = jest.fn().mockReturnValue(views);
      window.location.href = "chrome-extension://id-value/index.html";

      BrowserApi.reloadOpenWindows(true);

      expect(window.location.reload).toHaveBeenCalledTimes(0);
      expect(mockWindow.location.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe("getBrowserAction", () => {
    it("returns the `chrome.action` API if the extension manifest is for version 3", () => {
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(3);

      const result = BrowserApi.getBrowserAction();

      expect(result).toEqual(chrome.action);
    });

    it("returns the `chrome.browserAction` API if the extension manifest is for version 2", () => {
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(2);

      const result = BrowserApi.getBrowserAction();

      expect(result).toEqual(chrome.browserAction);
    });
  });

  describe("executeScriptInTab", () => {
    it("calls to the extension api to execute a script within the give tabId", async () => {
      const tabId = 1;
      const injectDetails = mock<chrome.extensionTypes.InjectDetails>();
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(2);
      (chrome.tabs.executeScript as jest.Mock).mockImplementation(
        (tabId, injectDetails, callback) => callback(executeScriptResult),
      );

      const result = await BrowserApi.executeScriptInTab(tabId, injectDetails);

      expect(chrome.tabs.executeScript).toHaveBeenCalledWith(
        tabId,
        injectDetails,
        expect.any(Function),
      );
      expect(result).toEqual(executeScriptResult);
    });

    it("calls the manifest v3 scripting API if the extension manifest is for v3", async () => {
      const tabId = 1;
      const injectDetails = mock<chrome.extensionTypes.InjectDetails>({
        file: "file.js",
        allFrames: true,
        runAt: "document_start",
        frameId: null,
      });
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(3);
      (chrome.scripting.executeScript as jest.Mock).mockResolvedValue(executeScriptResult);

      const result = await BrowserApi.executeScriptInTab(tabId, injectDetails);

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: {
          tabId: tabId,
          allFrames: injectDetails.allFrames,
        },
        files: [injectDetails.file],
        injectImmediately: true,
        world: "ISOLATED",
      });
      expect(result).toEqual(executeScriptResult);
    });

    it("injects the script into a specified frameId when the extension is built for manifest v3", async () => {
      const tabId = 1;
      const frameId = 2;
      const injectDetails = mock<chrome.extensionTypes.InjectDetails>({
        file: "file.js",
        allFrames: true,
        runAt: "document_start",
        frameId,
      });
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(3);
      (chrome.scripting.executeScript as jest.Mock).mockResolvedValue(executeScriptResult);

      await BrowserApi.executeScriptInTab(tabId, injectDetails);

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: {
          tabId: tabId,
          frameIds: [frameId],
        },
        files: [injectDetails.file],
        injectImmediately: true,
        world: "ISOLATED",
      });
    });

    it("injects the script into the MAIN world context when injecting a script for manifest v3", async () => {
      const tabId = 1;
      const injectDetails = mock<chrome.extensionTypes.InjectDetails>({
        file: null,
        allFrames: true,
        runAt: "document_start",
        frameId: null,
      });
      const scriptingApiDetails = { world: "MAIN" as chrome.scripting.ExecutionWorld };
      jest.spyOn(BrowserApi, "manifestVersion", "get").mockReturnValue(3);
      (chrome.scripting.executeScript as jest.Mock).mockResolvedValue(executeScriptResult);

      const result = await BrowserApi.executeScriptInTab(tabId, injectDetails, scriptingApiDetails);

      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: {
          tabId: tabId,
          allFrames: injectDetails.allFrames,
        },
        files: null,
        injectImmediately: true,
        world: "MAIN",
      });
      expect(result).toEqual(executeScriptResult);
    });
  });

  describe("browserAutofillSettingsOverridden", () => {
    it("returns true if the browser autofill settings are overridden", async () => {
      const mockFn = jest.fn<
        void,
        [
          details: chrome.types.ChromeSettingGetDetails,
          callback: (details: chrome.types.ChromeSettingGetResult<boolean>) => void,
        ],
        never
      >((details, callback) => {
        callback({
          value: false,
          levelOfControl: "controlled_by_this_extension",
        });
      });
      chrome.privacy.services.autofillAddressEnabled.get = mockFn as unknown as ChromeSettingsGet;
      chrome.privacy.services.autofillCreditCardEnabled.get =
        mockFn as unknown as ChromeSettingsGet;
      chrome.privacy.services.passwordSavingEnabled.get = mockFn as unknown as ChromeSettingsGet;

      const result = await BrowserApi.browserAutofillSettingsOverridden();

      expect(result).toBe(true);
    });

    it("returns false if the browser autofill settings are not overridden", async () => {
      const mockFn = jest.fn<
        void,
        [
          details: chrome.types.ChromeSettingGetDetails,
          callback: (details: chrome.types.ChromeSettingGetResult<boolean>) => void,
        ],
        never
      >((details, callback) => {
        callback({
          value: true,
          levelOfControl: "controlled_by_this_extension",
        });
      });

      chrome.privacy.services.autofillAddressEnabled.get = mockFn as unknown as ChromeSettingsGet;
      chrome.privacy.services.autofillCreditCardEnabled.get =
        mockFn as unknown as ChromeSettingsGet;
      chrome.privacy.services.passwordSavingEnabled.get = mockFn as unknown as ChromeSettingsGet;

      const result = await BrowserApi.browserAutofillSettingsOverridden();

      expect(result).toBe(false);
    });

    it("returns false if the browser autofill settings are not controlled by the extension", async () => {
      const mockFn = jest.fn<
        void,
        [
          details: chrome.types.ChromeSettingGetDetails,
          callback: (details: chrome.types.ChromeSettingGetResult<boolean>) => void,
        ],
        never
      >((details, callback) => {
        callback({
          value: false,
          levelOfControl: "controlled_by_other_extensions",
        });
      });
      chrome.privacy.services.autofillAddressEnabled.get = mockFn as unknown as ChromeSettingsGet;
      chrome.privacy.services.autofillCreditCardEnabled.get =
        mockFn as unknown as ChromeSettingsGet;
      chrome.privacy.services.passwordSavingEnabled.get = mockFn as unknown as ChromeSettingsGet;

      const result = await BrowserApi.browserAutofillSettingsOverridden();

      expect(result).toBe(false);
    });
  });

  describe("updateDefaultBrowserAutofillSettings", () => {
    it("updates the default browser autofill settings", async () => {
      await BrowserApi.updateDefaultBrowserAutofillSettings(false);

      expect(chrome.privacy.services.autofillAddressEnabled.set).toHaveBeenCalledWith({
        value: false,
      });
      expect(chrome.privacy.services.autofillCreditCardEnabled.set).toHaveBeenCalledWith({
        value: false,
      });
      expect(chrome.privacy.services.passwordSavingEnabled.set).toHaveBeenCalledWith({
        value: false,
      });
    });
  });

  describe("registerContentScriptsMv2", () => {
    const details: browser.contentScripts.RegisteredContentScriptOptions = {
      matches: ["<all_urls>"],
      js: [{ file: "content/fido2/page-script.js" }],
    };

    it("registers content scripts through the `browser.contentScripts` API when the API is available", async () => {
      globalThis.browser = mock<typeof browser>({
        contentScripts: { register: jest.fn() },
      });

      await BrowserApi.registerContentScriptsMv2(details);

      expect(browser.contentScripts.register).toHaveBeenCalledWith(details);
    });

    it("registers content scripts through the `registerContentScriptsPolyfill` when the `browser.contentScripts.register` API is not available", async () => {
      globalThis.browser = mock<typeof browser>({
        contentScripts: { register: undefined },
      });
      jest.spyOn(BrowserApi, "addListener");

      await BrowserApi.registerContentScriptsMv2(details);

      expect(BrowserApi.addListener).toHaveBeenCalledWith(
        chrome.webNavigation.onCommitted,
        expect.any(Function),
      );
    });
  });

  /*
   * Safari sometimes returns >1 tabs unexpectedly even when
   * specificing a `windowId` or `currentWindow: true` query option.
   *
   * For example, when there are >=2 windows with an active pinned tab,
   * the pinned tab will always be included as the first entry in the array,
   * while the correct tab is included as the second entry.
   *
   * These tests can remain as verification when Safari fixes this bug.
   */
  describe.each([{ isSafariApi: true }, { isSafariApi: false }])(
    "SafariTabsQuery %p",
    ({ isSafariApi }) => {
      let originalIsSafariApi = BrowserApi.isSafariApi;
      const expectedWindowId = 10;
      const wrongWindowId = expectedWindowId + 1;
      const raceConditionWindowId = expectedWindowId + 2;
      const mismatchedWindowId = expectedWindowId + 3;

      const resolvedTabsQueryResult = [
        mock<chrome.tabs.Tab>({
          title: "tab[0] is a pinned tab from another window",
          pinned: true,
          windowId: wrongWindowId,
        }),
        mock<chrome.tabs.Tab>({
          title: "tab[1] is the tab with the correct foreground window",
          windowId: expectedWindowId,
        }),
      ];

      function mockCurrentWindowId(id: number | null) {
        jest
          .spyOn(BrowserApi, "getCurrentWindow")
          .mockResolvedValue(mock<chrome.windows.Window>({ id }));
      }

      beforeEach(() => {
        originalIsSafariApi = BrowserApi.isSafariApi;
        BrowserApi.isSafariApi = isSafariApi;
        mockCurrentWindowId(expectedWindowId);
        jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue(resolvedTabsQueryResult);
      });

      afterEach(() => {
        BrowserApi.isSafariApi = originalIsSafariApi;
        jest.restoreAllMocks();
      });

      describe.each([BrowserApi.getTabFromCurrentWindow, BrowserApi.getTabFromCurrentWindowId])(
        "%p",
        (getCurrTabFn) => {
          it("returns the first tab when the query result has one tab", async () => {
            const expectedSingleTab = resolvedTabsQueryResult[0];
            jest.spyOn(BrowserApi, "tabsQuery").mockResolvedValue([expectedSingleTab]);
            const actualTab = await getCurrTabFn();
            expect(actualTab).toBe(expectedSingleTab);
          });

          it("returns the first tab when the current window ID is mismatched", async () => {
            mockCurrentWindowId(mismatchedWindowId);
            const actualTab = await getCurrTabFn();
            expect(actualTab).toBe(resolvedTabsQueryResult[0]);
          });

          it("returns the first tab when the current window ID is unavailable", async () => {
            mockCurrentWindowId(null);
            const actualTab = await getCurrTabFn();
            expect(actualTab).toBe(resolvedTabsQueryResult[0]);
          });

          if (isSafariApi) {
            it("returns the tab with the current window ID", async () => {
              const actualTab = await getCurrTabFn();
              expect(actualTab.windowId).toBe(expectedWindowId);
            });

            it(`returns the tab with the current window ID at the time of calling [Function ${getCurrTabFn.name}]`, async () => {
              jest.spyOn(BrowserApi, "tabsQuery").mockImplementation(() => {
                /*
                 * Simulate rapid clicking/switching between windows, e.g.
                 * 1. From Window A, call `getCurrTabFn()`
                 * 2. getCurrTabFn() calls `await BrowserApi.tabsQuery()`
                 * 3. Users switches to Window B before the `await` returns
                 * 4. getCurrTabFn() calls `await BrowserApi.getCurrentWindow()`
                 * ^ This now returns Window B and filters the results erroneously
                 */
                mockCurrentWindowId(raceConditionWindowId);

                return Promise.resolve(resolvedTabsQueryResult);
              });

              const actualTab = await getCurrTabFn();
              expect(actualTab.windowId).toBe(expectedWindowId);
            });
          } /* !isSafariApi */ else {
            it("falls back to tabsQueryFirst", async () => {
              const tabsQueryFirstSpy = jest.spyOn(BrowserApi, "tabsQueryFirst");
              const actualTab = await getCurrTabFn();

              expect(tabsQueryFirstSpy).toHaveBeenCalled();
              expect(actualTab).toBe(resolvedTabsQueryResult[0]);
            });
          }
        },
      );
    },
  );
});
