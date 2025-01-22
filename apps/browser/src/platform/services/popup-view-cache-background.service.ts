// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { switchMap, merge, delay, filter, concatMap, map, first, of } from "rxjs";

import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import {
  POPUP_VIEW_MEMORY,
  KeyDefinition,
  GlobalStateProvider,
} from "@bitwarden/common/platform/state";

import { BrowserApi } from "../browser/browser-api";
import { fromChromeEvent } from "../browser/from-chrome-event";

const popupClosedPortName = "new_popup";

/** We cannot use `UserKeyDefinition` because we must be able to store state when there is no active user. */
export const POPUP_VIEW_CACHE_KEY = KeyDefinition.record<string>(
  POPUP_VIEW_MEMORY,
  "popup-view-cache",
  {
    deserializer: (jsonValue) => jsonValue,
  },
);

export const POPUP_ROUTE_HISTORY_KEY = new KeyDefinition<string[]>(
  POPUP_VIEW_MEMORY,
  "popup-route-history",
  {
    deserializer: (jsonValue) => jsonValue,
  },
);

export const SAVE_VIEW_CACHE_COMMAND = new CommandDefinition<{
  key: string;
  value: string;
}>("save-view-cache");

export const ClEAR_VIEW_CACHE_COMMAND = new CommandDefinition("clear-view-cache");

export class PopupViewCacheBackgroundService {
  private popupViewCacheState = this.globalStateProvider.get(POPUP_VIEW_CACHE_KEY);
  private popupRouteHistoryState = this.globalStateProvider.get(POPUP_ROUTE_HISTORY_KEY);

  constructor(
    private messageListener: MessageListener,
    private globalStateProvider: GlobalStateProvider,
  ) {}

  startObservingTabChanges() {
    this.messageListener
      .messages$(SAVE_VIEW_CACHE_COMMAND)
      .pipe(
        concatMap(async ({ key, value }) =>
          this.popupViewCacheState.update((state) => ({
            ...state,
            [key]: value,
          })),
        ),
      )
      .subscribe();

    this.messageListener
      .messages$(ClEAR_VIEW_CACHE_COMMAND)
      .pipe(concatMap(() => this.popupViewCacheState.update(() => null)))
      .subscribe();

    merge(
      // on tab changed, excluding extension tabs
      fromChromeEvent(chrome.tabs.onActivated).pipe(
        switchMap((tabs) => BrowserApi.getTab(tabs[0].tabId)),
        switchMap((tab) => {
          // FireFox sets the `url` to "about:blank" and won't populate the `url` until the `onUpdated` event
          if (tab.url !== "about:blank") {
            return of(tab);
          }

          return fromChromeEvent(chrome.tabs.onUpdated).pipe(
            first(),
            switchMap(([tabId]) => BrowserApi.getTab(tabId)),
          );
        }),
        map((tab) => tab.url || tab.pendingUrl),
        filter((url) => !url.startsWith(chrome.runtime.getURL(""))),
      ),

      // on popup closed, with 2 minute delay that is cancelled by re-opening the popup
      fromChromeEvent(chrome.runtime.onConnect).pipe(
        filter(([port]) => port.name === popupClosedPortName),
        switchMap(([port]) => fromChromeEvent(port.onDisconnect).pipe(delay(1000 * 60 * 2))),
      ),
    )
      .pipe(switchMap(() => this.clearState()))
      .subscribe();
  }

  async clearState() {
    return Promise.all([
      this.popupViewCacheState.update(() => ({}), { shouldUpdate: this.objNotEmpty }),
      this.popupRouteHistoryState.update(() => [], { shouldUpdate: this.objNotEmpty }),
    ]);
  }

  private objNotEmpty(obj: object): boolean {
    return Object.keys(obj ?? {}).length !== 0;
  }
}

/**
 * Communicates to {@link PopupViewCacheBackgroundService} that the extension popup has been closed.
 *
 * Call in the foreground.
 **/
export const initPopupClosedListener = () => {
  chrome.runtime.connect({ name: popupClosedPortName });
};
