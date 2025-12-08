import { switchMap, filter, map, first, of } from "rxjs";

import { GlobalStateProvider } from "@bitwarden/common/platform/state";

import { BrowserApi } from "../browser/browser-api";
import { fromChromeEvent } from "../browser/from-chrome-event";

import { POPUP_ROUTE_HISTORY_KEY } from "./popup-view-cache-background.service";

export class PopupRouterCacheBackgroundService {
  private popupRouteHistoryState = this.globalStateProvider.get(POPUP_ROUTE_HISTORY_KEY);

  constructor(private globalStateProvider: GlobalStateProvider) {}

  init() {
    fromChromeEvent(chrome.tabs.onActivated)
      .pipe(
        switchMap((tabs) => BrowserApi.getTab(tabs[0].tabId)!),
        switchMap((tab) => {
          // FireFox sets the `url` to "about:blank" and won't populate the `url` until the `onUpdated` event
          if (tab.url !== "about:blank") {
            return of(tab);
          }

          return fromChromeEvent(chrome.tabs.onUpdated).pipe(
            first(),
            switchMap(([tabId]) => BrowserApi.getTab(tabId)!),
          );
        }),
        map((tab) => tab.url || tab.pendingUrl),
        filter((url) => !url?.startsWith(chrome.runtime.getURL(""))),
        switchMap(() =>
          this.popupRouteHistoryState.update((state) => {
            if (!state || state.length === 0) {
              return state;
            }

            const lastRoute = state.at(-1);
            if (!lastRoute) {
              return state;
            }

            // When the last route has resetRouterCacheOnTabChange set
            // Reset the route history to empty to force the user to the default route
            if (lastRoute.options?.resetRouterCacheOnTabChange) {
              return [];
            }

            return state;
          }),
        ),
      )
      .subscribe();
  }
}
