import { BehaviorSubject } from "rxjs";

import { BadgeBrowserApi, RawBadgeState } from "../badge-browser-api";

export class MockBadgeBrowserApi implements BadgeBrowserApi {
  private _activeTab$ = new BehaviorSubject<chrome.tabs.TabActiveInfo | undefined>(undefined);
  activeTab$ = this._activeTab$.asObservable();

  specificStates: Record<number, RawBadgeState> = {};
  generalState?: RawBadgeState;
  tabs: number[] = [];

  setActiveTab(tabId: number) {
    this._activeTab$.next({
      tabId,
      windowId: 1,
    });
  }

  setState(state: RawBadgeState, tabId?: number): Promise<void> {
    if (tabId !== undefined) {
      this.specificStates[tabId] = state;
    } else {
      this.generalState = state;
    }

    return Promise.resolve();
  }

  getTabs(): Promise<number[]> {
    return Promise.resolve(this.tabs);
  }
}
