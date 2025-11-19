import { switchMap, delay, filter, concatMap, map, first, of } from "rxjs";

import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import {
  ScheduledTaskNames,
  TaskSchedulerService,
  toScheduler,
} from "@bitwarden/common/platform/scheduling";
import {
  POPUP_VIEW_MEMORY,
  KeyDefinition,
  GlobalStateProvider,
} from "@bitwarden/common/platform/state";

import { BrowserApi } from "../browser/browser-api";
import { fromChromeEvent } from "../browser/from-chrome-event";

const popupClosedPortName = "new_popup";

export type ViewCacheOptions = {
  /**
   * Optional flag to persist the cached value between navigation events.
   */
  persistNavigation?: boolean;

  /**
   * When set, the cached value will be cleared when the user changes tabs.
   * @optional
   */
  clearOnTabChange?: true;
};

export type ViewCacheState = {
  /**
   * The cached value
   */
  value: string; // JSON value

  /**
   * Options for managing/clearing the cache
   */
  options?: ViewCacheOptions;
};

export type RouteCacheOptions = {
  /**
   * When true, the route history will be reset on tab change and respective route was the last visited route.
   * i.e. Upon the user re-opening the extension the route history will be empty and the user will be taken to the default route.
   */
  resetRouterCacheOnTabChange?: boolean;
};

export type RouteHistoryCacheState = {
  /** Route URL */
  url: string;

  /** Options for managing the route history cache */
  options?: RouteCacheOptions;
};

/** We cannot use `UserKeyDefinition` because we must be able to store state when there is no active user. */
export const POPUP_VIEW_CACHE_KEY = KeyDefinition.record<ViewCacheState>(
  POPUP_VIEW_MEMORY,
  "popup-view-cache",
  {
    deserializer: (jsonValue) => jsonValue,
  },
);

export const POPUP_ROUTE_HISTORY_KEY = new KeyDefinition<RouteHistoryCacheState[]>(
  POPUP_VIEW_MEMORY,
  "popup-route-history-details",
  {
    deserializer: (jsonValue) => jsonValue,
  },
);

export const SAVE_VIEW_CACHE_COMMAND = new CommandDefinition<{
  key: string;
  value: string;
  options: ViewCacheOptions;
}>("save-view-cache");

export const ClEAR_VIEW_CACHE_COMMAND = new CommandDefinition<{
  /**
   * Flag to indicate the clear request was triggered by a route change in popup.
   */
  routeChange: boolean;
}>("clear-view-cache");

export class PopupViewCacheBackgroundService {
  private popupViewCacheState = this.globalStateProvider.get(POPUP_VIEW_CACHE_KEY);
  private popupRouteHistoryState = this.globalStateProvider.get(POPUP_ROUTE_HISTORY_KEY);

  constructor(
    private messageListener: MessageListener,
    private globalStateProvider: GlobalStateProvider,
    private readonly taskSchedulerService: TaskSchedulerService,
  ) {
    this.taskSchedulerService.registerTaskHandler(
      ScheduledTaskNames.clearPopupViewCache,
      async () => {
        await this.clearState();
      },
    );
  }

  startObservingMessages() {
    this.messageListener
      .messages$(SAVE_VIEW_CACHE_COMMAND)
      .pipe(
        concatMap(async ({ key, value, options }) =>
          this.popupViewCacheState.update((state) => ({
            ...state,
            [key]: {
              value,
              options,
            },
          })),
        ),
      )
      .subscribe();

    this.messageListener
      .messages$(ClEAR_VIEW_CACHE_COMMAND)
      .pipe(
        concatMap(({ routeChange }) =>
          this.popupViewCacheState.update((state) => {
            if (routeChange && state) {
              // Only remove keys that are not marked with `persistNavigation`
              return Object.fromEntries(
                Object.entries(state).filter(([, { options }]) => options?.persistNavigation),
              );
            }
            return null;
          }),
        ),
      )
      .subscribe();

    // on popup closed, with 2 minute delay that is cancelled by re-opening the popup
    fromChromeEvent(chrome.runtime.onConnect)
      .pipe(
        filter(
          ([port]) => port.name === popupClosedPortName && BrowserApi.senderIsInternal(port.sender),
        ),
        switchMap(([port]) =>
          fromChromeEvent(port.onDisconnect).pipe(
            delay(
              1000 * 60 * 2,
              toScheduler(this.taskSchedulerService, ScheduledTaskNames.clearPopupViewCache),
            ),
          ),
        ),
      )
      .subscribe();

    // On tab changed, excluding extension tabs
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
          this.popupViewCacheState.update((state) => {
            if (!state) {
              return null;
            }
            // Only remove keys that are marked with `clearOnTabChange`
            return Object.fromEntries(
              Object.entries(state).filter(([, { options }]) => !options?.clearOnTabChange),
            );
          }),
        ),
      )
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
