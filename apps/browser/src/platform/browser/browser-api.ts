import { DeviceType } from "@bitwarden/common/enums";

import { TabMessage } from "../../types/tab-messages";
import BrowserPlatformUtilsService from "../services/browser-platform-utils.service";

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

  static getWindow(windowId?: number): Promise<chrome.windows.Window> | void {
    if (!windowId) {
      return;
    }

    return new Promise((resolve) =>
      chrome.windows.get(windowId, { populate: true }, (window) => resolve(window))
    );
  }

  static async createWindow(options: chrome.windows.CreateData): Promise<chrome.windows.Window> {
    return new Promise((resolve) =>
      chrome.windows.create(options, (window) => {
        resolve(window);
      })
    );
  }

  static async getTabFromCurrentWindowId(): Promise<chrome.tabs.Tab> | null {
    return await BrowserApi.tabsQueryFirst({
      active: true,
      windowId: chrome.windows.WINDOW_ID_CURRENT,
    });
  }

  static async getTab(tabId: number): Promise<chrome.tabs.Tab> | null {
    if (!tabId) {
      return null;
    }

    if (BrowserApi.manifestVersion === 3) {
      return await chrome.tabs.get(tabId);
    }

    return new Promise((resolve) =>
      chrome.tabs.get(tabId, (tab) => {
        resolve(tab);
      })
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
    data: any = null
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
    options: chrome.tabs.MessageSendOptions = null
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
    responseCallback?: (response: T) => void
  ) {
    chrome.tabs.sendMessage<TabMessage, T>(tabId, message, options, responseCallback);
  }

  static async removeTab(tabId: number) {
    await chrome.tabs.remove(tabId);
  }

  static async getPrivateModeWindows(): Promise<browser.windows.Window[]> {
    return (await browser.windows.getAll()).filter((win) => win.incognito);
  }

  static async onWindowCreated(callback: (win: chrome.windows.Window) => any) {
    return chrome.windows.onCreated.addListener(callback);
  }

  static getBackgroundPage(): any {
    return chrome.extension.getBackgroundPage();
  }

  static isBackgroundPage(window: Window & typeof globalThis): boolean {
    return window === chrome.extension.getBackgroundPage();
  }

  static getApplicationVersion(): string {
    return chrome.runtime.getManifest().version;
  }

  static async isPopupOpen(): Promise<boolean> {
    return Promise.resolve(chrome.extension.getViews({ type: "popup" }).length > 0);
  }

  static createNewTab(url: string, active = true): Promise<chrome.tabs.Tab> {
    return new Promise((resolve) =>
      chrome.tabs.create({ url: url, active: active }, (tab) => resolve(tab))
    );
  }

  static async focusWindow(windowId: number) {
    await chrome.windows.update(windowId, { focused: true });
  }

  static async openBitwardenExtensionTab(relativeUrl: string, active = true) {
    let url = relativeUrl;
    if (!relativeUrl.includes("uilocation=tab")) {
      const fullUrl = chrome.extension.getURL(relativeUrl);
      const parsedUrl = new URL(fullUrl);
      parsedUrl.searchParams.set("uilocation", "tab");
      url = parsedUrl.toString();
    }

    const createdTab = await this.createNewTab(url, active);
    this.focusWindow(createdTab.windowId);
  }

  static async closeBitwardenExtensionTab() {
    const tabs = await BrowserApi.tabsQuery({
      active: true,
      title: "Bitwarden",
      windowType: "normal",
      currentWindow: true,
    });

    if (tabs.length === 0) {
      return;
    }

    const tabToClose = tabs[tabs.length - 1];
    BrowserApi.removeTab(tabToClose.id);
  }

  // Keep track of all the events registered in a Safari popup so we can remove
  // them when the popup gets unloaded, otherwise we cause a memory leak
  private static registeredMessageListeners: any[] = [];
  private static registeredStorageChangeListeners: any[] = [];

  static messageListener(
    name: string,
    callback: (message: any, sender: chrome.runtime.MessageSender, response: any) => void
  ) {
    chrome.runtime.onMessage.addListener(callback);

    if (BrowserApi.isSafariApi && !BrowserApi.isBackgroundPage(window)) {
      BrowserApi.registeredMessageListeners.push(callback);
      BrowserApi.setupUnloadListeners();
    }
  }

  static storageChangeListener(
    callback: Parameters<typeof chrome.storage.onChanged.addListener>[0]
  ) {
    chrome.storage.onChanged.addListener(callback);

    if (BrowserApi.isSafariApi && !BrowserApi.isBackgroundPage(window)) {
      BrowserApi.registeredStorageChangeListeners.push(callback);
      BrowserApi.setupUnloadListeners();
    }
  }

  // Setup the event to destroy all the listeners when the popup gets unloaded in Safari, otherwise we get a memory leak
  private static setupUnloadListeners() {
    // The MDN recommend using 'visibilitychange' but that event is fired any time the popup window is obscured as well
    // 'pagehide' works just like 'unload' but is compatible with the back/forward cache, so we prefer using that one
    window.onpagehide = () => {
      for (const callback of BrowserApi.registeredMessageListeners) {
        chrome.runtime.onMessage.removeListener(callback);
      }

      for (const callback of BrowserApi.registeredStorageChangeListeners) {
        chrome.storage.onChanged.removeListener(callback);
      }
    };
  }

  static sendMessage(subscriber: string, arg: any = {}) {
    const message = Object.assign({}, { command: subscriber }, arg);
    return chrome.runtime.sendMessage(message);
  }

  static async focusTab(tabId: number) {
    chrome.tabs.update(tabId, { active: true, highlighted: true });
  }

  static closePopup(win: Window) {
    if (BrowserApi.isWebExtensionsApi && BrowserApi.isFirefoxOnAndroid) {
      // Reactivating the active tab dismisses the popup tab. The promise final
      // condition is only called if the popup wasn't already dismissed (future proofing).
      // ref: https://bugzilla.mozilla.org/show_bug.cgi?id=1433604
      browser.tabs.update({ active: true }).finally(win.close);
    } else {
      win.close();
    }
  }

  static gaFilter() {
    return process.env.ENV !== "production";
  }

  static getUILanguage(win: Window) {
    return chrome.i18n.getUILanguage();
  }

  static reloadExtension(win: Window) {
    if (win != null) {
      return (win.location as any).reload(true);
    } else {
      return chrome.runtime.reload();
    }
  }

  static reloadOpenWindows(exemptCurrentHref = false) {
    const currentHref = window.location.href;
    const views = chrome.extension.getViews() as Window[];
    views
      .filter((w) => w.location.href != null && !w.location.href.includes("background.html"))
      .filter((w) => !exemptCurrentHref || w.location.href !== currentHref)
      .forEach((w) => {
        w.location.reload();
      });
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
    return new Promise((resolve, reject) => {
      chrome.permissions.request(permission, resolve);
    });
  }

  static getPlatformInfo(): Promise<browser.runtime.PlatformInfo | chrome.runtime.PlatformInfo> {
    if (BrowserApi.isWebExtensionsApi) {
      return browser.runtime.getPlatformInfo();
    }
    return new Promise((resolve) => {
      chrome.runtime.getPlatformInfo(resolve);
    });
  }

  static getBrowserAction() {
    return BrowserApi.manifestVersion === 3 ? chrome.action : chrome.browserAction;
  }

  static getSidebarAction(
    win: Window & typeof globalThis
  ): OperaSidebarAction | FirefoxSidebarAction | null {
    const deviceType = BrowserPlatformUtilsService.getDevice(win);
    if (deviceType !== DeviceType.FirefoxExtension && deviceType !== DeviceType.OperaExtension) {
      return null;
    }
    return win.opr?.sidebarAction || browser.sidebarAction;
  }

  /**
   * Extension API helper method used to execute a script in a tab.
   * @see https://developer.chrome.com/docs/extensions/reference/tabs/#method-executeScript
   * @param {number} tabId
   * @param {chrome.tabs.InjectDetails} details
   * @returns {Promise<unknown>}
   */
  static executeScriptInTab(tabId: number, details: chrome.tabs.InjectDetails) {
    if (BrowserApi.manifestVersion === 3) {
      return chrome.scripting.executeScript({
        target: {
          tabId: tabId,
          allFrames: details.allFrames,
          frameIds: details.frameId ? [details.frameId] : null,
        },
        files: details.file ? [details.file] : null,
        injectImmediately: details.runAt === "document_start",
      });
    }

    return new Promise((resolve) => {
      chrome.tabs.executeScript(tabId, details, (result) => {
        resolve(result);
      });
    });
  }
}
