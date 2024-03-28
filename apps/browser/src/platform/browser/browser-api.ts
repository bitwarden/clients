import { Observable } from "rxjs";

import { DeviceType } from "@bitwarden/common/enums";

import { TabMessage } from "../../types/tab-messages";
import { BrowserPlatformUtilsService } from "../services/platform-utils/browser-platform-utils.service";

export class BrowserApi {
  static isWebExtensionsApi: boolean = typeof browser !== "undefined";
  static isSafariApi: boolean =
    navigator.userAgent.indexOf(" Safari/") !== -1 &&
    navigator.userAgent.indexOf(" Chrome/") === -1 &&
    navigator.userAgent.indexOf(" Chromium/") === -1;
  static isChromeApi: boolean = !BrowserApi.isSafariApi && typeof chrome !== "undefined";
  static isFirefoxOnAndroid: boolean =
    navigator.userAgent.indexOf("Firefox/") !== -1 && navigator.userAgent.indexOf("Android") !== -1;

  static get manifestVersion() {
    return chrome.runtime.getManifest().manifest_version;
  }

  /**
   * Determines if the extension manifest version is the given version.
   *
   * @param expectedVersion - The expected manifest version to check against.
   */
  static isManifestVersion(expectedVersion: 2 | 3) {
    return BrowserApi.manifestVersion === expectedVersion;
  }

  /**
   * Gets the current window or the window with the given id.
   *
   * @param windowId - The id of the window to get. If not provided, the current window is returned.
   */
  static async getWindow(windowId?: number): Promise<chrome.windows.Window> {
    if (!windowId) {
      return BrowserApi.getCurrentWindow();
    }

    return await BrowserApi.getWindowById(windowId);
  }

  /**
   * Gets the currently active browser window.
   */
  static async getCurrentWindow(): Promise<chrome.windows.Window> {
    return new Promise((resolve) => chrome.windows.getCurrent({ populate: true }, resolve));
  }

  /**
   * Gets the window with the given id.
   *
   * @param windowId - The id of the window to get.
   */
  static async getWindowById(windowId: number): Promise<chrome.windows.Window> {
    return new Promise((resolve) => chrome.windows.get(windowId, { populate: true }, resolve));
  }

  static async createWindow(options: chrome.windows.CreateData): Promise<chrome.windows.Window> {
    return new Promise((resolve) =>
      chrome.windows.create(options, (window) => {
        resolve(window);
      }),
    );
  }

  /**
   * Removes the window with the given id.
   *
   * @param windowId - The id of the window to remove.
   */
  static async removeWindow(windowId: number): Promise<void> {
    return new Promise((resolve) => chrome.windows.remove(windowId, () => resolve()));
  }

  /**
   * Updates the properties of the window with the given id.
   *
   * @param windowId - The id of the window to update.
   * @param options - The window properties to update.
   */
  static async updateWindowProperties(
    windowId: number,
    options: chrome.windows.UpdateInfo,
  ): Promise<void> {
    return new Promise((resolve) =>
      chrome.windows.update(windowId, options, () => {
        resolve();
      }),
    );
  }

  /**
   * Focuses the window with the given id.
   *
   * @param windowId - The id of the window to focus.
   */
  static async focusWindow(windowId: number) {
    await BrowserApi.updateWindowProperties(windowId, { focused: true });
  }

  static async getTabFromCurrentWindowId(): Promise<chrome.tabs.Tab> | null {
    return await BrowserApi.tabsQueryFirst({
      active: true,
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });
  }

  /**
   * Gets the tab with the given id.
   *
   * @param tabId - The id of the tab to get.
   */
  static async getTab(tabId: number): Promise<chrome.tabs.Tab> | null {
    if (!tabId) {
      return null;
    }

    if (BrowserApi.isManifestVersion(3)) {
      return await chrome.tabs.get(tabId);
    }

    return new Promise((resolve) =>
      chrome.tabs.get(tabId, (tab) => {
        resolve(tab);
      }),
    );
  }

  static async getTabFromCurrentWindow(): Promise<chrome.tabs.Tab> | null {
    return await BrowserApi.tabsQueryFirst({
      active: true,
      currentWindow: true,
    });
  }

  static async getActiveTabs(): Promise<chrome.tabs.Tab[]> {
    return await BrowserApi.tabsQuery({
      active: true,
    });
  }

  static async tabsQuery(options: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.query(options, (tabs) => {
        resolve(tabs);
      });
    });
  }

  static async tabsQueryFirst(options: chrome.tabs.QueryInfo): Promise<chrome.tabs.Tab> | null {
    const tabs = await BrowserApi.tabsQuery(options);
    if (tabs.length > 0) {
      return tabs[0];
    }

    return null;
  }

  static tabSendMessageData(
    tab: chrome.tabs.Tab,
    command: string,
    data: any = null,
  ): Promise<void> {
    const obj: any = {
      command: command,
    };

    if (data != null) {
      obj.data = data;
    }

    return BrowserApi.tabSendMessage(tab, obj);
  }

  static async tabSendMessage<T>(
    tab: chrome.tabs.Tab,
    obj: T,
    options: chrome.tabs.MessageSendOptions = null,
  ): Promise<void> {
    if (!tab || !tab.id) {
      return;
    }

    return new Promise<void>((resolve) => {
      chrome.tabs.sendMessage(tab.id, obj, options, () => {
        if (chrome.runtime.lastError) {
          // Some error happened
        }
        resolve();
      });
    });
  }

  static sendTabsMessage<T>(
    tabId: number,
    message: TabMessage,
    options?: chrome.tabs.MessageSendOptions,
    responseCallback?: (response: T) => void,
  ) {
    chrome.tabs.sendMessage<TabMessage, T>(tabId, message, options, responseCallback);
  }

  static async getPrivateModeWindows(): Promise<browser.windows.Window[]> {
    return (await browser.windows.getAll()).filter((win) => win.incognito);
  }

  static async onWindowCreated(callback: (win: chrome.windows.Window) => any) {
    // FIXME: Make sure that is does not cause a memory leak in Safari or use BrowserApi.AddListener
    // and test that it doesn't break.
    // eslint-disable-next-line no-restricted-syntax
    return chrome.windows.onCreated.addListener(callback);
  }

  /**
   * Gets the background page for the extension. This method is
   * not valid within manifest v3 background service workers. As
   * a result, it will return null when called from that context.
   */
  static getBackgroundPage(): any {
    if (typeof chrome.extension.getBackgroundPage === "undefined") {
      return null;
    }

    return chrome.extension.getBackgroundPage();
  }

  /**
   * Accepts a window object and determines if it is
   * associated with the background page of the extension.
   *
   * @param window - The window to check.
   */
  static isBackgroundPage(window: Window & typeof globalThis): boolean {
    return typeof window !== "undefined" && window === BrowserApi.getBackgroundPage();
  }

  static getApplicationVersion(): string {
    return chrome.runtime.getManifest().version;
  }

  /**
   * Gets the extension views that match the given properties. This method is not
   * available within background service worker. As a result, it will return an
   * empty array when called from that context.
   *
   * @param fetchProperties - The properties used to filter extension views.
   */
  static getExtensionViews(fetchProperties?: chrome.extension.FetchProperties): Window[] {
    if (typeof chrome.extension.getViews === "undefined") {
      return [];
    }

    return chrome.extension.getViews(fetchProperties);
  }

  /**
   * Queries all extension views that are of type `popup`
   * and returns whether any are currently open.
   */
  static async isPopupOpen(): Promise<boolean> {
    return Promise.resolve(BrowserApi.getExtensionViews({ type: "popup" }).length > 0);
  }

  static createNewTab(url: string, active = true): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) =>
      chrome.tabs.create({ url: url, active: active }, (tab) => resolve(tab)),
    );
  }

  // Keep track of all the events registered in a Safari popup so we can remove
  // them when the popup gets unloaded, otherwise we cause a memory leak
  private static trackedChromeEventListeners: [
    event: chrome.events.Event<(...args: unknown[]) => unknown>,
    callback: (...args: unknown[]) => unknown,
  ][] = [];

  static messageListener(
    name: string,
    callback: (
      message: any,
      sender: chrome.runtime.MessageSender,
      sendResponse: any,
    ) => boolean | void,
  ) {
    BrowserApi.addListener(chrome.runtime.onMessage, callback);
  }

  static messageListener$() {
    return new Observable<unknown>((subscriber) => {
      const handler = (message: unknown) => {
        subscriber.next(message);
      };

      BrowserApi.addListener(chrome.runtime.onMessage, handler);

      return () => BrowserApi.removeListener(chrome.runtime.onMessage, handler);
    });
  }

  static storageChangeListener(
    callback: Parameters<typeof chrome.storage.onChanged.addListener>[0],
  ) {
    BrowserApi.addListener(chrome.storage.onChanged, callback);
  }

  /**
   * Adds a callback to the given chrome event in a cross-browser platform manner.
   *
   * **Important:** All event listeners in the browser extension popup context must
   * use this instead of the native APIs to handle unsubscribing from Safari properly.
   *
   * @param event - The event in which to add the listener to.
   * @param callback - The callback you want registered onto the event.
   */
  static addListener<T extends (...args: readonly unknown[]) => unknown>(
    event: chrome.events.Event<T>,
    callback: T,
  ) {
    event.addListener(callback);

    if (BrowserApi.isSafariApi && !BrowserApi.isBackgroundPage(self)) {
      BrowserApi.trackedChromeEventListeners.push([event, callback]);
      BrowserApi.setupUnloadListeners();
    }
  }

  /**
   * Removes a callback from the given chrome event in a cross-browser platform manner.
   * @param event - The event in which to remove the listener from.
   * @param callback - The callback you want removed from the event.
   */
  static removeListener<T extends (...args: readonly unknown[]) => unknown>(
    event: chrome.events.Event<T>,
    callback: T,
  ) {
    event.removeListener(callback);

    if (BrowserApi.isSafariApi && !BrowserApi.isBackgroundPage(self)) {
      const index = BrowserApi.trackedChromeEventListeners.findIndex(([_event, eventListener]) => {
        return eventListener == callback;
      });
      if (index !== -1) {
        BrowserApi.trackedChromeEventListeners.splice(index, 1);
      }
    }
  }

  // Setup the event to destroy all the listeners when the popup gets unloaded in Safari, otherwise we get a memory leak
  private static setupUnloadListeners() {
    // The MDN recommend using 'visibilitychange' but that event is fired any time the popup window is obscured as well
    // 'pagehide' works just like 'unload' but is compatible with the back/forward cache, so we prefer using that one
    self.addEventListener("pagehide", () => {
      for (const [event, callback] of BrowserApi.trackedChromeEventListeners) {
        event.removeListener(callback);
      }
    });
  }

  static sendMessage(subscriber: string, arg: any = {}) {
    const message = Object.assign({}, { command: subscriber }, arg);
    return chrome.runtime.sendMessage(message);
  }

  static sendMessageWithResponse<TResponse>(subscriber: string, arg: any = {}) {
    const message = Object.assign({}, { command: subscriber }, arg);
    return new Promise<TResponse>((resolve) => chrome.runtime.sendMessage(message, resolve));
  }

  static async focusTab(tabId: number) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    chrome.tabs.update(tabId, { active: true, highlighted: true });
  }

  static closePopup(win: Window) {
    if (BrowserApi.isWebExtensionsApi && BrowserApi.isFirefoxOnAndroid) {
      // Reactivating the active tab dismisses the popup tab. The promise final
      // condition is only called if the popup wasn't already dismissed (future proofing).
      // ref: https://bugzilla.mozilla.org/show_bug.cgi?id=1433604
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      browser.tabs.update({ active: true }).finally(win.close);
    } else {
      win.close();
    }
  }

  static gaFilter() {
    return process.env.ENV !== "production";
  }

  static getUILanguage() {
    return chrome.i18n.getUILanguage();
  }

  /**
   * Handles reloading the extension, either by calling the window location
   * to reload or by calling the extension's runtime to reload.
   *
   * @param globalContext - The global context to use for the reload.
   */
  static reloadExtension(globalContext: (Window & typeof globalThis) | null) {
    // The passed globalContext might be a ServiceWorkerGlobalScope, as a result
    // we need to check if the location object exists before calling reload on it.
    if (typeof globalContext?.location?.reload === "function") {
      return (globalContext as any).location.reload(true);
    }

    return chrome.runtime.reload();
  }

  /**
   * Reloads all open extension views, except the background page. Will also
   * skip reloading the current window location if exemptCurrentHref is true.
   *
   * @param exemptCurrentHref - Whether to exempt the current window location from the reload.
   */
  static reloadOpenWindows(exemptCurrentHref = false) {
    const views = BrowserApi.getExtensionViews();
    if (!views.length) {
      return;
    }

    const currentHref = self.location.href;
    views
      .filter((w) => w.location.href != null && !w.location.href.includes("background.html"))
      .filter((w) => !exemptCurrentHref || w.location.href !== currentHref)
      .forEach((w) => w.location.reload());
  }

  static connectNative(application: string): browser.runtime.Port | chrome.runtime.Port {
    if (BrowserApi.isWebExtensionsApi) {
      return browser.runtime.connectNative(application);
    } else if (BrowserApi.isChromeApi) {
      return chrome.runtime.connectNative(application);
    }
  }

  static requestPermission(permission: any) {
    if (BrowserApi.isWebExtensionsApi) {
      return browser.permissions.request(permission);
    }
    return new Promise((resolve) => {
      chrome.permissions.request(permission, resolve);
    });
  }

  /**
   * Checks if the user has provided the given permissions to the extension.
   *
   * @param permissions - The permissions to check.
   */
  static async permissionsGranted(permissions: string[]): Promise<boolean> {
    return new Promise((resolve) =>
      chrome.permissions.contains({ permissions }, (result) => resolve(result)),
    );
  }

  static getPlatformInfo(): Promise<browser.runtime.PlatformInfo | chrome.runtime.PlatformInfo> {
    if (BrowserApi.isWebExtensionsApi) {
      return browser.runtime.getPlatformInfo();
    }
    return new Promise((resolve) => {
      chrome.runtime.getPlatformInfo(resolve);
    });
  }

  /**
   * Returns the supported BrowserAction API based on the manifest version.
   */
  static getBrowserAction() {
    return BrowserApi.isManifestVersion(3) ? chrome.action : chrome.browserAction;
  }

  static getSidebarAction(
    win: Window & typeof globalThis,
  ): OperaSidebarAction | FirefoxSidebarAction | null {
    const deviceType = BrowserPlatformUtilsService.getDevice(win);
    if (deviceType !== DeviceType.FirefoxExtension && deviceType !== DeviceType.OperaExtension) {
      return null;
    }
    return win.opr?.sidebarAction || browser.sidebarAction;
  }

  static captureVisibleTab(): Promise<string> {
    return new Promise((resolve) => {
      chrome.tabs.captureVisibleTab(null, { format: "png" }, resolve);
    });
  }

  /**
   * Extension API helper method used to execute a script in a tab.
   *
   * @see https://developer.chrome.com/docs/extensions/reference/tabs/#method-executeScript
   * @param tabId - The id of the tab to execute the script in.
   * @param details {@link "InjectDetails" https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/extensionTypes/InjectDetails}
   * @param scriptingApiDetails {@link "ExecutionWorld" https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/scripting/ExecutionWorld}
   */
  static executeScriptInTab(
    tabId: number,
    details: chrome.tabs.InjectDetails,
    scriptingApiDetails?: {
      world: chrome.scripting.ExecutionWorld;
    },
  ): Promise<unknown> {
    if (BrowserApi.isManifestVersion(3)) {
      return chrome.scripting.executeScript({
        target: {
          tabId: tabId,
          allFrames: details.allFrames,
          frameIds: details.frameId ? [details.frameId] : null,
        },
        files: details.file ? [details.file] : null,
        injectImmediately: details.runAt === "document_start",
        world: scriptingApiDetails?.world || "ISOLATED",
      });
    }

    return new Promise((resolve) => {
      chrome.tabs.executeScript(tabId, details, (result) => {
        resolve(result);
      });
    });
  }

  /**
   * Identifies if the browser autofill settings are overridden by the extension.
   */
  static async browserAutofillSettingsOverridden(): Promise<boolean> {
    const checkOverrideStatus = (details: chrome.types.ChromeSettingGetResultDetails) =>
      details.levelOfControl === "controlled_by_this_extension" && !details.value;

    const autofillAddressOverridden: boolean = await new Promise((resolve) =>
      chrome.privacy.services.autofillAddressEnabled.get({}, (details) =>
        resolve(checkOverrideStatus(details)),
      ),
    );

    const autofillCreditCardOverridden: boolean = await new Promise((resolve) =>
      chrome.privacy.services.autofillCreditCardEnabled.get({}, (details) =>
        resolve(checkOverrideStatus(details)),
      ),
    );

    const passwordSavingOverridden: boolean = await new Promise((resolve) =>
      chrome.privacy.services.passwordSavingEnabled.get({}, (details) =>
        resolve(checkOverrideStatus(details)),
      ),
    );

    return autofillAddressOverridden && autofillCreditCardOverridden && passwordSavingOverridden;
  }

  /**
   * Updates the browser autofill settings to the given value.
   *
   * @param value - Determines whether to enable or disable the autofill settings.
   */
  static updateDefaultBrowserAutofillSettings(value: boolean) {
    chrome.privacy.services.autofillAddressEnabled.set({ value });
    chrome.privacy.services.autofillCreditCardEnabled.set({ value });
    chrome.privacy.services.passwordSavingEnabled.set({ value });
  }

  /**
   * Opens the offscreen document with the given reasons and justification.
   *
   * @param reasons - List of reasons for opening the offscreen document.
   * @see https://developer.chrome.com/docs/extensions/reference/api/offscreen#type-Reason
   * @param justification - Custom written justification for opening the offscreen document.
   */
  static async createOffscreenDocument(reasons: chrome.offscreen.Reason[], justification: string) {
    await chrome.offscreen.createDocument({
      url: "offscreen-document/index.html",
      reasons,
      justification,
    });
  }

  /**
   * Closes the offscreen document.
   *
   * @param callback - Optional callback to execute after the offscreen document is closed.
   */
  static closeOffscreenDocument(callback?: () => void) {
    chrome.offscreen.closeDocument(() => {
      if (callback) {
        callback();
      }
    });
  }
}
