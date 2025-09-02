import { BehaviorSubject } from "rxjs";

import { BadgeBrowserApi, RawBadgeState } from "../badge-browser-api";

export class MockBadgeBrowserApi implements BadgeBrowserApi {
  private _activeTab$ = new BehaviorSubject<chrome.tabs.TabActiveInfo | undefined>(undefined);
  activeTab$ = this._activeTab$.asObservable();

  specificStates: Record<number, RawBadgeState> = {};
  generalState?: RawBadgeState;
  tabs: number[] = [];
  activeTabs: number[] = [];

  getActiveTabs(): Promise<chrome.tabs.Tab[]> {
    return Promise.resolve(
      this.activeTabs.map(
        (tabId) =>
          ({
            id: tabId,
            windowId: 1,
            active: true,
          }) as chrome.tabs.Tab,
      ),
    );
  }

  setActiveTabs(tabs: number[]) {
    this.activeTabs = tabs;
  }

  setLastActivatedTab(tabId: number) {
    this._activeTab$.next({
      tabId,
      windowId: 1,
    });
  }

  setState = jest.fn().mockImplementation((state: RawBadgeState, tabId?: number): Promise<void> => {
    if (tabId !== undefined) {
      this.specificStates[tabId] = state;
    } else {
      this.generalState = state;
    }

    return Promise.resolve();
  });

  getTabs(): Promise<number[]> {
    return Promise.resolve(this.tabs);
  }
}
