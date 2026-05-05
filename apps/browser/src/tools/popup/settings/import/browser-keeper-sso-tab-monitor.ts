import { Injectable } from "@angular/core";

import { KeeperSsoTabMonitor } from "@bitwarden/importer-ui";

import { BrowserApi } from "../../../../platform/browser/browser-api";

@Injectable({ providedIn: "root" })
export class BrowserKeeperSsoTabMonitor implements KeeperSsoTabMonitor {
  private activeTabId: number | undefined;
  private activeListener:
    | ((tabId: number, changeInfo: chrome.tabs.OnUpdatedInfo, tab: chrome.tabs.Tab) => void)
    | undefined;

  async launchAndWaitForToken(ssoUrl: string, callbackUrlPattern: RegExp): Promise<string> {
    const tab = await BrowserApi.createNewTab(ssoUrl, true);
    this.activeTabId = tab.id;

    return new Promise<string>((resolve, reject) => {
      const listener = (
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

        chrome.scripting
          .executeScript({
            target: { tabId },
            func: () => ({
              bodyText: document.body?.innerText ?? "",
              bodyHtml: document.body?.innerHTML ?? "",
            }),
          })
          .then((results) => {
            const payload = results?.[0]?.result as
              | { bodyText: string; bodyHtml: string }
              | undefined;

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

      this.activeListener = listener;
      BrowserApi.addListener(chrome.tabs.onUpdated, listener);
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
    if (this.activeListener) {
      BrowserApi.removeListener(chrome.tabs.onUpdated, this.activeListener);
      this.activeListener = undefined;
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
