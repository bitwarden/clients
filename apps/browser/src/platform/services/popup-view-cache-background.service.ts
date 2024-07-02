import { switchMap, merge, delay, filter, concatMap } from "rxjs";

import { CommandDefinition, MessageListener } from "@bitwarden/common/platform/messaging";
import {
  POPUP_VIEW_MEMORY,
  KeyDefinition,
  GlobalStateProvider,
} from "@bitwarden/common/platform/state";

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

  async init() {
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
      .pipe(
        concatMap(async () => {
          return this.popupViewCacheState.update(() => ({}), { shouldUpdate: this.objNotEmpty });
        }),
      )
      .subscribe();

    merge(
      // on tab changed
      fromChromeEvent(chrome.tabs.onActivated),

      // on popup closed, with 2 minute delay that is cancelled by re-opening the popup
      fromChromeEvent(chrome.runtime.onConnect).pipe(
        filter(([port]) => port.name === popupClosedPortName),
        switchMap(([port]) => fromChromeEvent(port.onDisconnect).pipe(delay(1000 * 60 * 2))),
      ),
    )
      .pipe(switchMap(() => this.clearState()))
      .subscribe();

    await this.clearState();
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
