declare function escape(s: string): string;
declare function unescape(s: string): string;
/**
 * @link https://dev.opera.com/extensions/addons-api/
 */
type OperaAddons = {
  /**
   * @link https://dev.opera.com/extensions/addons-api/#method-installextension
   */
  installExtension: (
    id: string,
    success_callback: () => void,
    error_callback: (errorMessage: string) => void,
  ) => void;
};

type OperaEvent<T> = {
  addListener: (callback: (state: T) => void) => void;
};

/**
 * @link https://dev.opera.com/extensions/sidebar-action-api/#type-colorarray
 */
type ColorArray = [number, number, number, number];

/**
 * @link https://dev.opera.com/extensions/sidebar-action-api/#type-imagedatatype
 */
type ImageDataType = ImageData;

/**
 * @link https://dev.opera.com/extensions/sidebar-action-api/
 */
type OperaSidebarAction = {
  /**
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-settitle
   */
  setTitle: (details: { title: string; tabId?: number }) => void;
  /**
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-gettitle
   */
  getTitle: (details: { tabId?: number }, callback: (result: string) => void) => void;
  /**
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-seticon
   */
  setIcon: (
    details: {
      imageData?: ImageDataType | Record<number, ImageDataType>;
      path?: string | Record<number, string>;
      tabId?: number;
    },
    callback?: () => void,
  ) => void;
  /**
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-setpanel
   */
  setPanel: (details: { tabId?: number; panel: string }) => void;
  /**
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-getpanel
   */
  getPanel: (details: { tabId?: number }, callback: (result: string) => void) => void;
  /**
   * *Not supported on mac*
   *
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-setbadgetext
   */
  setBadgeText: (details: { text: string; tabId?: number }) => void;
  /**
   * *Not supported on mac*
   *
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-getbadgetext
   */
  getBadgeText: (details: { tabId?: number }, callback: (result: string) => void) => void;
  /**
   * *Not supported on mac*
   *
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-setbadgebackgroundcolor
   */
  setBadgeBackgroundColor: (details: { color: ColorArray | string; tabId?: number }) => void;
  /**
   * *Not supported on mac*
   *
   * @link https://dev.opera.com/extensions/sidebar-action-api/#method-getbadgebackgroundcolor
   */
  getBadgeBackgroundColor: (
    details: { tabId?: number },
    callback: (result: ColorArray) => void,
  ) => void;
  /**
   * *Not supported on mac*
   *
   * @link https://dev.opera.com/extensions/sidebar-action-api/#events-onfocus
   */
  onFocus: OperaEvent<Window>;
  /**
   * *Not supported on mac*
   *
   * @link https://dev.opera.com/extensions/sidebar-action-api/#events-onblur
   */
  onBlur: OperaEvent<Window>;
};

/**
 * This is for firefox's sidebar action and it is based on the opera one but with a few less methods
 *
 * @link https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/sidebarAction
 */
type FirefoxSidebarAction = typeof browser.sidebarAction;

type Opera = {
  addons: OperaAddons;
  sidebarAction: OperaSidebarAction;
};

interface Window {
  opr: Opera | undefined;
  opera: unknown;
}

interface ServiceWorkerGlobalScope {
  chrome?: typeof chrome;
  opr?: Opera | undefined;
  opera?: unknown;
}

declare let opr: Opera | undefined;
declare let opera: unknown | undefined;
declare let safari: any;
