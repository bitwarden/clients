import { Injectable } from "@angular/core";

import { KeeperSsoTabMonitor } from "@bitwarden/importer-ui";

import { BrowserApi } from "../../../../platform/browser/browser-api";

@Injectable({ providedIn: "root" })
export class BrowserKeeperSsoTabMonitor implements KeeperSsoTabMonitor {
  private activeTabId: number | undefined;
  private activeUpdatedListener:
    | ((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void)
    | undefined;
  private activeRemovedListener: ((tabId: number) => void) | undefined;

  async launchAndWaitForToken(ssoUrl: string, callbackUrlPattern: RegExp): Promise<string> {
    const tab = await BrowserApi.createNewTab(ssoUrl, true);
    this.activeTabId = tab.id;

    return new Promise<string>((resolve, reject) => {
      const updatedListener = (
        tabId: number,
        _changeInfo: chrome.tabs.OnUpdatedInfo,
        updatedTab: chrome.tabs.Tab,
      ) => {
        if (tabId !== this.activeTabId) {
          return;
        }

        if (updatedTab.status !== "complete" || !updatedTab.url) {
          return;
        }

        if (!callbackUrlPattern.test(updatedTab.url)) {
          return;
        }

        this.detach();

        BrowserApi.executeFunctionInTab<{ bodyText: string; bodyHtml: string }>(tabId, () => ({
          bodyText: document.body?.innerText ?? "",
          bodyHtml: document.body?.innerHTML ?? "",
        }))
          .then((payload) => {
            if (!payload) {
              reject(new Error("Failed to extract SSO token from callback page"));
              return;
            }

            const token = extractToken(payload.bodyText, payload.bodyHtml);
            BrowserApi.closeTab(tabId).catch((): void => undefined);
            this.activeTabId = undefined;

            if (!token) {
              reject(new Error("No token candidate found on callback page"));
              return;
            }
            resolve(token);
          })
          .catch((error) => {
            this.activeTabId = undefined;
            reject(error);
          });
      };

      const removedListener = (tabId: number) => {
        if (tabId !== this.activeTabId) {
          return;
        }
        this.detach();
        this.activeTabId = undefined;
        reject(new Error("SSO login tab was closed before completing"));
      };

      this.activeUpdatedListener = updatedListener;
      this.activeRemovedListener = removedListener;
      BrowserApi.addListener(chrome.tabs.onUpdated, updatedListener);
      BrowserApi.addListener(chrome.tabs.onRemoved, removedListener);
    });
  }

  cancel(): void {
    this.detach();
    if (this.activeTabId != null) {
      BrowserApi.closeTab(this.activeTabId).catch((): void => undefined);
      this.activeTabId = undefined;
    }
  }

  private detach(): void {
    if (this.activeUpdatedListener) {
      BrowserApi.removeListener(chrome.tabs.onUpdated, this.activeUpdatedListener);
      this.activeUpdatedListener = undefined;
    }
    if (this.activeRemovedListener) {
      BrowserApi.removeListener(chrome.tabs.onRemoved, this.activeRemovedListener);
      this.activeRemovedListener = undefined;
    }
  }
}

const BASE64URL_RUN = /[A-Za-z0-9_-]{40,}/g;

function extractToken(bodyText: string, bodyHtml: string): string | undefined {
  const trimmed = bodyText.trim();
  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    return trimmed;
  }

  const candidates: string[] = [];
  for (const source of [bodyText, bodyHtml]) {
    const matches = source.match(BASE64URL_RUN);
    if (matches) {
      candidates.push(...matches);
    }
  }
  if (candidates.length === 0) {
    return undefined;
  }
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0];
}
