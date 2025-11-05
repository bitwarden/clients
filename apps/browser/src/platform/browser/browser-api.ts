// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

import { BrowserClientVendors } from "@bitwarden/common/autofill/constants";
import { BrowserClientVendor } from "@bitwarden/common/autofill/types";
import { DeviceType } from "@bitwarden/common/enums";
import { isBrowserSafariApi } from "@bitwarden/platform";

import { TabMessage } from "../../types/tab-messages";
import { BrowserPlatformUtilsService } from "../services/platform-utils/browser-platform-utils.service";

import { registerContentScriptsPolyfill } from "./browser-api.register-content-scripts-polyfill";

export class BrowserApi {
  static isWebExtensionsApi: boolean = typeof browser !== "undefined";
  static isSafariApi: boolean = isBrowserSafariApi();
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

  static senderIsInternal(sender: chrome.runtime.MessageSender | null): boolean {
    if (!sender?.url) {
      return false;
    }
    const extensionUrl =
      (typeof chrome !== "undefined" && chrome.runtime?.getURL("")) ||
      (typeof browser !== "undefined" && browser.runtime?.getURL("")) ||
      "";

    if (!extensionUrl) {
      return false;
    }

    if (!sender.url.startsWith(extensionUrl)) {
      return false;
    }

    // these are all properties on externally initiated messages, not internal ones
    if (sender.tab || sender.documentId || sender.documentLifecycle || sender.frameId) {
      return false;
    }

    return true;
  }

  /**
   * Gets all open browser windows, including their tabs.
   *
   * @returns A promise that resolves to an array of browser windows.
   */
  static async getWindows(): Promise<chrome.windows.Window[]> {
    return new Promise((resolve) => chrome.windows.getAll({ populate: true }, resolve));
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
    return new Promise((resolve) => {
      chrome.windows.create(options, async (newWindow) => {
        if (!BrowserApi.isSafariApi) {
          return resolve(newWindow);
        }
        // Safari doesn't close the default extension popup when a new window is created so we need to
        // manually trigger the close by focusing the main window after the new window is created
        const allWindows = await new Promise<chrome.windows.Window[]>((resolve) => {
          chrome.windows.getAll({ windowTypes: ["normal"] }, (windows) => resolve(windows));
        });

        const mainWindow = allWindows.find((window) => window.id !== newWindow.id);

        // No main window found, resolve the new window
        if (mainWindow == null || !mainWindow.id) {
          return resolve(newWindow);
        }

        // Focus the main window to close the extension popup
        chrome.windows.update(mainWindow.id, { focused: true }, () => {
          // Refocus the newly created window
          chrome.windows.update(newWindow.id, { focused: true }, () => {
            resolve(newWindow);
          });
        });
      });
    });
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
    return await BrowserApi.tabsQueryFirstCurrentWindowForSafari({
      active: true,
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });
  }

  static getBrowserClientVendor(clientWindow: Window): BrowserClientVendor {
    const device = BrowserPlatformUtilsService.getDevice(clientWindow);

    switch (device) {
      case DeviceType.ChromeExtension:
      case DeviceType.ChromeBrowser:
        return BrowserClientVendors.Chrome;
      case DeviceType.OperaExtension:
      case DeviceType.OperaBrowser:
        return BrowserClientVendors.Opera;
      case DeviceType.EdgeExtension:
      case DeviceType.EdgeBrowser:
        return BrowserClientVendors.Edge;
      case DeviceType.VivaldiExtension:
      case DeviceType.VivaldiBrowser:
        return BrowserClientVendors.Vivaldi;
      default:
        return BrowserClientVendors.Unknown;
    }
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
    return await BrowserApi.tabsQueryFirstCurrentWindowForSafari({
      active: true,
      currentWindow: true,
    });
  }

  static async getActiveTabs(): Promise<chrome.tabs.Tab[]> {
    return await BrowserApi.tabsQuery({
      active: true,
    });
  }

  /**
   * Fetch the currently open browser tab
   */
  static async getCurrentTab(): Promise<chrome.tabs.Tab> | null {
    if (BrowserApi.isManifestVersion(3)) {
      return await chrome.tabs.getCurrent();
    }

    return new Promise((resolve) =>
      chrome.tabs.getCurrent((tab) => {
        resolve(tab);
      }),
    );
  }

  /**
   * Closes a browser tab with the given id
   *
   * @param tabId The id of the tab to close
   */
  static async closeTab(tabId: number): Promise<void> {
    if (tabId) {
      if (BrowserApi.isWebExtensionsApi) {
        browser.tabs.remove(tabId).catch((error) => {
          throw new Error("[BrowserApi] Failed to remove current tab: " + error.message);
        });
      } else if (BrowserApi.isChromeApi) {
        chrome.tabs.remove(tabId).catch((error) => {
          throw new Error("[BrowserApi] Failed to remove current tab: " + error.message);
        });
      }
    }
  }

  /**
   * Navigates a browser tab to the given URL
   *
   * @param tabId The id of the tab to navigate
   * @param url The URL to navigate to
   */
  static async navigateTabToUrl(tabId: number, url: URL): Promise<void> {
    if (tabId) {
      if (BrowserApi.isWebExtensionsApi) {
        browser.tabs.update(tabId, { url: url.href }).catch((error) => {
          throw new Error("Failed to navigate tab to URL: " + error.message);
        });
      } else if (BrowserApi.isChromeApi) {
        chrome.tabs.update(tabId, { url: url.href }, () => {
          if (chrome.runtime.lastError) {
            throw new Error("Failed to navigate tab to URL: " + chrome.runtime.lastError.message);
          }
        });
      }
    }
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

  /**
   * Drop-in replacement for {@link BrowserApi.tabsQueryFirst}.
   *
   * Safari sometimes returns >1 tabs unexpectedly even when
   * specifying a `windowId` or `currentWindow: true` query option.
   *
   * For all of these calls,
   * ```
   * await chrome.tabs.query({active: true, currentWindow: true})
   * await chrome.tabs.query({active: true, windowId: chrome.windows.WINDOW_ID_CURRENT})
   * await chrome.tabs.query({active: true, windowId: 10})
   * ```
   *
   * Safari could return:
   * ```
   * [
   *   {windowId: 2, pinned: true, title: "Incorrect tab in another window", …},
   *   {windowId: 10, title: "Correct tab in foreground", …},
   * ]
   * ```
   *
   * This function captures the current window ID manually before running the query,
   * then finds and returns the tab with the matching window ID.
   *
   * See the `SafariTabsQuery` tests in `browser-api.spec.ts`.
   *
   * This workaround can be removed when Safari fixes this bug.
   */
  static async tabsQueryFirstCurrentWindowForSafari(
    options: chrome.tabs.QueryInfo,
  ): Promise<chrome.tabs.Tab> | null {
    if (!BrowserApi.isSafariApi) {
      return await BrowserApi.tabsQueryFirst(options);
    }

    const currentWindowId = (await BrowserApi.getCurrentWindow()).id;
    const tabs = await BrowserApi.tabsQuery(options);

    if (tabs.length <= 1 || currentWindowId == null) {
      return tabs[0];
    }

    return tabs.find((t) => t.windowId === currentWindowId) ?? tabs[0];
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

  static async tabSendMessage<T, TResponse = unknown>(
    tab: chrome.tabs.Tab,
    obj: T,
    options: chrome.tabs.MessageSendOptions = null,
    rejectOnError = false,
  ): Promise<TResponse> {
    if (!tab || !tab.id) {
      return;
    }

    return new Promise<TResponse>((resolve, reject) => {
      chrome.tabs.sendMessage(tab.id, obj, options, (response) => {
        if (chrome.runtime.lastError && rejectOnError) {
          // Some error happened
          reject();
        }
        resolve(response);
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

  static getRuntimeURL(path: string): string {
    if (BrowserApi.isWebExtensionsApi) {
      return browser.runtime.getURL(path);
    } else if (BrowserApi.isChromeApi) {
      return chrome.runtime.getURL(path);
    }
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

  /**
   * Gathers the details for a specified sub-frame of a tab.
   *
   * @param details - The details of the frame to get.
   */
  static async getFrameDetails(
    details: chrome.webNavigation.GetFrameDetails,
  ): Promise<chrome.webNavigation.GetFrameResultDetails> {
    return new Promise((resolve) => chrome.webNavigation.getFrame(details, resolve));
  }

  /**
   * Gets all frames associated with a tab.
   *
   * @param tabId - The id of the tab to get the frames for.
   */
  static async getAllFrameDetails(
    tabId: chrome.tabs.Tab["id"],
  ): Promise<chrome.webNavigation.GetAllFrameResultDetails[]> {
    return new Promise((resolve) => chrome.webNavigation.getAllFrames({ tabId }, resolve));
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
  static addListener<T extends (...args: readonly any[]) => any>(
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
   * Handles reloading the extension using the underlying functionality exposed by the browser API.
   */
  static reloadExtension() {
    // If we do `chrome.runtime.reload` on safari they will send an onInstalled reason of install
    // and that prompts us to show a new tab, this apparently doesn't happen on sideloaded
    // extensions and only shows itself production scenarios. See: https://bitwarden.atlassian.net/browse/PM-12298
    if (this.isSafariApi) {
      return self.location.reload();
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
  static async permissionsGranted(
    permissions: chrome.runtime.ManifestPermissions[],
  ): Promise<boolean> {
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
    if (deviceType === DeviceType.FirefoxExtension) {
      return browser.sidebarAction;
    }

    if (deviceType === DeviceType.OperaExtension) {
      return win.opr?.sidebarAction;
    }

    return null;
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
    details: chrome.extensionTypes.InjectDetails,
    scriptingApiDetails?: {
      world: chrome.scripting.ExecutionWorld;
    },
  ): Promise<unknown> {
    if (BrowserApi.isManifestVersion(3)) {
      let target: chrome.scripting.InjectionTarget;

      if (typeof details.frameId === "number") {
        target = { tabId, frameIds: [details.frameId] };
      } else if (details.allFrames) {
        target = { tabId, allFrames: true };
      } else {
        target = { tabId };
      }

      return chrome.scripting.executeScript({
        target,
        files: details.file ? [details.file] : null,
        injectImmediately: details.runAt === "document_start",
        world: scriptingApiDetails?.world || chrome.scripting.ExecutionWorld.ISOLATED,
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
    if (!(await BrowserApi.permissionsGranted(["privacy"]))) {
      return false;
    }

    const checkOverrideStatus = (details: chrome.types.ChromeSettingGetResult<boolean>) =>
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
  static async updateDefaultBrowserAutofillSettings(value: boolean) {
    await chrome.privacy.services.autofillAddressEnabled.set({ value });
    await chrome.privacy.services.autofillCreditCardEnabled.set({ value });
    await chrome.privacy.services.passwordSavingEnabled.set({ value });
  }

  /**
   * Handles registration of static content scripts within manifest v2.
   *
   * @param contentScriptOptions - Details of the registered content scripts
   */
  static async registerContentScriptsMv2(
    contentScriptOptions: browser.contentScripts.RegisteredContentScriptOptions,
  ): Promise<browser.contentScripts.RegisteredContentScript> {
    if (typeof browser !== "undefined" && !!browser.contentScripts?.register) {
      return await browser.contentScripts.register(contentScriptOptions);
    }

    return await registerContentScriptsPolyfill(contentScriptOptions);
  }

  /**
   * Handles registration of static content scripts within manifest v3.
   *
   * @param scripts - Details of the registered content scripts
   */
  static async registerContentScriptsMv3(
    scripts: chrome.scripting.RegisteredContentScript[],
  ): Promise<void> {
    await chrome.scripting.registerContentScripts(scripts);
  }

  /**
   * Handles unregistering of static content scripts within manifest v3.
   *
   * @param filter - Optional filter to unregister content scripts. Passing an empty object will unregister all content scripts.
   */
  static async unregisterContentScriptsMv3(
    filter?: chrome.scripting.ContentScriptFilter,
  ): Promise<void> {
    await chrome.scripting.unregisterContentScripts(filter);
  }
}
