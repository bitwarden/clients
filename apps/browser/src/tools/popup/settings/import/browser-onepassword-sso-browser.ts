import { OnePasswordSsoBrowser } from "@bitwarden/importer-ui";

import { BrowserApi } from "../../../../platform/browser/browser-api";

type RedirectListener = (details: chrome.webRequest.OnBeforeRedirectDetails) => void;
type UpdatedListener = (tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo) => void;
type RemovedListener = (tabId: number) => void;

function parseUrl(address: string): URL | undefined {
  try {
    return new URL(address);
  } catch {
    return undefined;
  }
}

function trimTrailingSlashes(path: string): string {
  return path.replace(/\/+$/, "");
}

/**
 * Whether `address` is the identity provider handing the user back to 1Password: the same scheme,
 * host and path as `redirectTo`. The authorization code that follows is left to the SDK.
 */
export function isSsoRedirect(address: string, redirectTo: URL): boolean {
  const url = parseUrl(address);
  return (
    url != null &&
    url.protocol === redirectTo.protocol &&
    url.host === redirectTo.host &&
    trimTrailingSlashes(url.pathname) === trimTrailingSlashes(redirectTo.pathname)
  );
}

/**
 * Signs in to 1Password with its identity provider in a new tab, like the Keeper importer does. The
 * identity provider redirects the tab to an address of the `onepassword://` scheme, which the
 * browser would hand to the 1Password app, so the redirect is caught from the tab's requests and the
 * tab is closed. Safari tells the extension nothing about the redirect, so it gets no single
 * sign-on.
 */
export class BrowserOnePasswordSsoBrowser extends OnePasswordSsoBrowser {
  readonly supported = BrowserApi.canObserveRedirects();

  private settlePending: ((redirectedTo: string | undefined) => void) | undefined;

  async login(ssoLoginUrl: string, redirectTo: string): Promise<string | undefined> {
    const loginUrl = parseUrl(ssoLoginUrl);
    const redirectUrl = parseUrl(redirectTo);
    if (loginUrl?.protocol !== "https:" || redirectUrl == null) {
      throw new Error("The 1Password sign-in address is not valid.");
    }

    this.cancel();

    // The tab opens blank and only goes to the identity provider once it is watched: with a session
    // there already, the identity provider redirects right away.
    const tab = await BrowserApi.createNewTab("about:blank", true);
    const tabId = tab.id;
    if (tabId == null) {
      throw new Error("The 1Password sign-in tab could not be opened.");
    }

    return new Promise((resolve) => {
      let settled = false;
      const settle = (redirectedTo: string | undefined, closeTab: boolean) => {
        if (settled) {
          return;
        }
        settled = true;
        BrowserApi.removeRedirectListener(onRedirect);
        BrowserApi.removeListener(chrome.tabs.onUpdated, onUpdated);
        BrowserApi.removeListener(chrome.tabs.onRemoved, onRemoved);
        if (this.settlePending === settleAndClose) {
          this.settlePending = undefined;
        }
        if (closeTab) {
          BrowserApi.closeTab(tabId).catch((): void => undefined);
        }
        resolve(redirectedTo);
      };
      const settleAndClose = (redirectedTo: string | undefined) => settle(redirectedTo, true);
      const capture = (address: string | undefined) => {
        if (address != null && isSsoRedirect(address, redirectUrl)) {
          settleAndClose(address);
        }
      };

      const onRedirect: RedirectListener = (details) => capture(details.redirectUrl);
      // A redirect to a web address shows up as the tab's address too.
      const onUpdated: UpdatedListener = (updatedTabId, changeInfo) => {
        if (updatedTabId === tabId) {
          capture(changeInfo.url);
        }
      };
      const onRemoved: RemovedListener = (removedTabId) => {
        if (removedTabId === tabId) {
          settle(undefined, false);
        }
      };

      this.settlePending = settleAndClose;
      BrowserApi.addRedirectListener(onRedirect, {
        urls: ["<all_urls>"],
        tabId,
        types: ["main_frame"],
      });
      BrowserApi.addListener(chrome.tabs.onUpdated, onUpdated);
      BrowserApi.addListener(chrome.tabs.onRemoved, onRemoved);

      BrowserApi.navigateTabToUrl(tabId, loginUrl).catch(() => settleAndClose(undefined));
    });
  }

  cancel(): void {
    this.settlePending?.(undefined);
  }
}
