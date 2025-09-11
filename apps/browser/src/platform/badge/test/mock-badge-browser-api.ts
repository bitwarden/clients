import { BehaviorSubject } from "rxjs";

import { BadgeBrowserApi, RawBadgeState, Tab } from "../badge-browser-api";

export class MockBadgeBrowserApi implements BadgeBrowserApi {
  private _activeTabsUpdated$ = new BehaviorSubject<Tab[]>([]);
  activeTabsUpdated$ = this._activeTabsUpdated$.asObservable();
  activeTabs$ = this._activeTabsUpdated$.asObservable();

  specificStates: Record<number, RawBadgeState> = {};
  generalState?: RawBadgeState;
  tabs: number[] = [];
  activeTabs: number[] = [];

  getActiveTabs(): Promise<Tab[]> {
    return Promise.resolve(
      this.activeTabs.map(
        (tabId) =>
          ({
            tabId,
            url: `https://example.com/${tabId}`,
          }) satisfies Tab,
      ),
    );
  }

  setActiveTabs(tabs: number[]) {
    this.activeTabs = tabs;
    this._activeTabsUpdated$.next(
      tabs.map((tabId) => ({ tabId, url: `https://example.com/${tabId}` })),
    );
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
