import { switchMap, merge, delay, filter, map } from "rxjs";

import {
  POPUP_VIEW_MEMORY,
  KeyDefinition,
  GlobalStateProvider,
} from "@bitwarden/common/platform/state";

import { fromChromeEvent } from "../browser/from-chrome-event";

const popupClosedPortName = "new_popup";

export const POPUP_ROUTE_HISTORY_KEY = new KeyDefinition<string[]>(
  POPUP_VIEW_MEMORY,
  "popup-route-history",
  {
    deserializer: (jsonValue) => jsonValue,
  },
);

export class PopupViewCacheBackgroundService {
  private popupRouteHistoryState = this.globalStateProvider.get(POPUP_ROUTE_HISTORY_KEY);

  constructor(private globalStateProvider: GlobalStateProvider) {}

  async init() {
    merge(
      // on tab changed, excluding extension tabs
      fromChromeEvent(chrome.tabs.onActivated).pipe(
        switchMap(([tabInfo]) => chrome.tabs.get(tabInfo.tabId)),
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
