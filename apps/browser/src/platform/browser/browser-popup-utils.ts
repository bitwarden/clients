// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore

import { ScrollOptions } from "./abstractions/browser-popup-utils.abstractions";
import { BrowserApi } from "./browser-api";

/**
 *
 * Value represents width in pixels
 */
export const PopupWidthOptions = Object.freeze({
  default: 380,
  wide: 480,
  "extra-wide": 600,
});

type PopupWidthOptions = typeof PopupWidthOptions;
export type PopupWidthOption = keyof PopupWidthOptions;

export default class BrowserPopupUtils {
  /**
   * Identifies if the popup is within the sidebar.
   *
   * @param win - The passed window object.
   */
  static inSidebar(win: Window): boolean {
    return BrowserPopupUtils.urlContainsSearchParams(win, "uilocation", "sidebar");
  }

  /**
   * Identifies if the popup is within the popout.
   *
   * @param win - The passed window object.
   */
  static inPopout(win: Window): boolean {
    return BrowserPopupUtils.urlContainsSearchParams(win, "uilocation", "popout");
  }

  /**
   * Check if the current popup view is open inside of the current browser tab
   * (it is possible in Chrome to open the extension in a tab)
   */
  static async isInTab() {
    const tabId = (await BrowserApi.getCurrentTab())?.id;

    if (tabId === undefined || tabId === null) {
      return false;
    }

    const result = BrowserApi.getExtensionViews({ tabId, type: "tab" });

    return result.length > 0;
  }

  /**
   * Identifies if the popup is within the single action popout.
   *
   * @param win - The passed window object.
   * @param popoutKey - The single action popout key used to identify the popout.
   */
  static inSingleActionPopout(win: Window, popoutKey: string): boolean {
    return BrowserPopupUtils.urlContainsSearchParams(win, "singleActionPopout", popoutKey);
  }

  /**
   * Identifies if the popup is within the popup.
   *
   * @param win - The passed window object.
   */
  static inPopup(win: Window): boolean {
    return (
      win.location.href.indexOf("uilocation=") === -1 ||
      win.location.href.indexOf("uilocation=popup") > -1
    );
  }

  /**
   * Gets the scroll position of the popup.
   *
   * @param win - The passed window object.
   * @param scrollingContainer - Element tag name of the scrolling container.
   */
  static getContentScrollY(win: Window, scrollingContainer = "main"): number {
    const content = win.document.getElementsByTagName(scrollingContainer)[0];
    return content.scrollTop;
  }

  /**
   * Sets the scroll position of the popup.
   *
   * @param win - The passed window object.
   * @param scrollYAmount - The amount to scroll the popup.
   * @param options - Allows for setting the delay in ms to wait before scrolling the popup and the scrolling container tag name.
   */
  static async setContentScrollY(
    win: Window,
    scrollYAmount: number | undefined,
    options: ScrollOptions = {
      delay: 0,
      containerSelector: "main",
    },
  ) {
    const { delay, containerSelector } = options;
    return new Promise<void>((resolve) =>
      win.setTimeout(() => {
        const container = win.document.querySelector(containerSelector);
        if (!isNaN(scrollYAmount) && container) {
          container.scrollTop = scrollYAmount;
        }

        resolve();
      }, delay),
    );
  }

  /**
   * Identifies if the background page needs to be initialized.
   */
  static backgroundInitializationRequired() {
    return !BrowserApi.getBackgroundPage() || BrowserApi.isManifestVersion(3);
  }

  /**
   * Opens a popout window of any extension page. If the popout window is already open, it will be focused.
   *
   * @param extensionUrlPath - A relative path to the extension page. Example: "popup/index.html#/tabs/vault"
   * @param options - Options for the popout window that overrides the default options.
   */
  static async openPopout(
    extensionUrlPath: string,
    options: {
      senderWindowId?: number;
      singleActionKey?: string;
      forceCloseExistingWindows?: boolean;
      windowOptions?: Partial<chrome.windows.CreateData>;
    } = {},
  ) {
    const { senderWindowId, singleActionKey, forceCloseExistingWindows, windowOptions } = options;
    const defaultPopoutWindowOptions: chrome.windows.CreateData = {
      type: "popup",
      focused: true,
      width: Math.max(
        PopupWidthOptions.default,
        typeof document === "undefined" ? PopupWidthOptions.default : document.body.clientWidth,
      ),
      height: 630,
    };
    const offsetRight = 15;
    const offsetTop = 90;
    const popupWidth = defaultPopoutWindowOptions.width;
    const senderWindow = await BrowserApi.getWindow(senderWindowId);
    const popoutWindowOptions = {
      left: senderWindow.left + senderWindow.width - popupWidth - offsetRight,
      top: senderWindow.top + offsetTop,
      ...defaultPopoutWindowOptions,
      ...windowOptions,
      url: BrowserPopupUtils.buildPopoutUrl(extensionUrlPath, singleActionKey),
    };

    if (
      (await BrowserPopupUtils.isSingleActionPopoutOpen(
        singleActionKey,
        popoutWindowOptions,
        forceCloseExistingWindows,
      )) &&
      !forceCloseExistingWindows
    ) {
      return;
    }
    const platform = await BrowserApi.getPlatformInfo();
    const isMacOS = platform.os === "mac";
    const isFullscreen = senderWindow.state === "fullscreen";
    const isFullscreenAndMacOS = isFullscreen && isMacOS;
    //macOS specific handling for improved UX when sender in fullscreen aka green button;
    if (isFullscreenAndMacOS) {
      await BrowserApi.updateWindowProperties(senderWindow.id, {
        state: "maximized",
      });

      //wait for macOS animation to finish
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    const newWindow = await BrowserApi.createWindow(popoutWindowOptions);

    if (isFullscreenAndMacOS) {
      await BrowserApi.updateWindowProperties(newWindow.id, {
        focused: true,
      });
    }

    return newWindow;
  }

  /**
   * Closes the single action popout window.
   *
   * @param popoutKey - The single action popout key used to identify the popout.
   * @param delayClose - The amount of time to wait before closing the popout. Defaults to 0.
   */
  static async closeSingleActionPopout(popoutKey: string, delayClose = 0): Promise<void> {
    const extensionUrl = chrome.runtime.getURL("popup/index.html");
    const tabs = await BrowserApi.tabsQuery({ url: `${extensionUrl}*` });
    for (const tab of tabs) {
      if (!tab.url.includes(`singleActionPopout=${popoutKey}`)) {
        continue;
      }

      setTimeout(() => BrowserApi.removeWindow(tab.windowId), delayClose);
    }
  }

  /**
   * Opens a popout window for the current page.
   * If the current page is set for the current tab, then the
   * popout window will be set for the vault items listing tab.
   *
   * @param win - The passed window object.
   * @param href - The href to open in the popout window.
   */
  static async openCurrentPagePopout(win: Window, href: string = null) {
    const popoutUrl = href || win.location.href;
    const parsedUrl = new URL(popoutUrl);
    let hashRoute = parsedUrl.hash;
    if (hashRoute.startsWith("#/tabs/current")) {
      hashRoute = "#/tabs/vault";
    }

    await BrowserPopupUtils.openPopout(`${parsedUrl.pathname}${hashRoute}`);

    if (BrowserPopupUtils.inPopup(win)) {
      BrowserApi.closePopup(win);
    }
  }

  /**
   * Identifies if a single action window is open based on the passed popoutKey.
   * Will focus the existing window, and close any other windows that might exist
   * with the same popout key.
   *
   * @param popoutKey - The single action popout key used to identify the popout.
   * @param windowInfo - The window info to use to update the existing window.
   * @param forceCloseExistingWindows - Identifies if the existing windows should be closed.
   */
  private static async isSingleActionPopoutOpen(
    popoutKey: string | undefined,
    windowInfo: chrome.windows.CreateData,
    forceCloseExistingWindows = false,
  ) {
    if (!popoutKey) {
      return false;
    }

    const extensionUrl = chrome.runtime.getURL("popup/index.html");
    const popoutTabs = (await BrowserApi.tabsQuery({ url: `${extensionUrl}*` })).filter((tab) =>
      tab.url.includes(`singleActionPopout=${popoutKey}`),
    );
    if (popoutTabs.length === 0) {
      return false;
    }

    if (!forceCloseExistingWindows) {
      // Update first, remove it from list
      const tab = popoutTabs.shift();
      await BrowserApi.updateWindowProperties(tab.windowId, {
        focused: true,
        width: windowInfo.width,
        height: windowInfo.height,
        top: windowInfo.top,
        left: windowInfo.left,
      });
    }

    popoutTabs.forEach((tab) => BrowserApi.removeWindow(tab.windowId));

    return true;
  }

  /**
   * Identifies if the url contains the specified search param and value.
   *
   * @param win - The passed window object.
   * @param searchParam - The search param to identify.
   * @param searchValue - The search value to identify.
   */
  private static urlContainsSearchParams(
    win: Window,
    searchParam: string,
    searchValue: string,
  ): boolean {
    return win.location.href.indexOf(`${searchParam}=${searchValue}`) > -1;
  }

  /**
   * Builds the popout url path. Ensures that the uilocation param is set to
   * `popout` and that the singleActionPopout param is set to the passed singleActionKey.
   *
   * @param extensionUrlPath - A relative path to the extension page. Example: "popup/index.html#/tabs/vault"
   * @param singleActionKey - The single action popout key used to identify the popout.
   */
  private static buildPopoutUrl(extensionUrlPath: string, singleActionKey: string) {
    const parsedUrl = new URL(chrome.runtime.getURL(extensionUrlPath));
    parsedUrl.searchParams.set("uilocation", "popout");

    if (singleActionKey) {
      parsedUrl.searchParams.set("singleActionPopout", singleActionKey);
    }

    return parsedUrl.toString();
  }
}
