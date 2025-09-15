import { BehaviorSubject, concat, defer, of, Subject, switchMap } from "rxjs";

import { BadgeBrowserApi, RawBadgeState, Tab, TabEvent } from "../badge-browser-api";

export class MockBadgeBrowserApi implements BadgeBrowserApi {
  private _activeTabs = new BehaviorSubject<Tab[]>([]);
  private _activeTabsUpdated$ = new BehaviorSubject<Tab[]>([]);
  private _tabEvents$ = new Subject<TabEvent>();
  activeTabsUpdated$ = this._activeTabsUpdated$.asObservable();
  activeTabs$ = this._activeTabsUpdated$.asObservable();

  tabEvents$ = concat(
    defer(() => [this.activeTabs]).pipe(
      switchMap((activeTabs) => {
        const tabEvents: TabEvent[] = activeTabs.map((tabId) => ({
          type: "activated",
          tab: { tabId, url: `https://example.com/${tabId}` },
        }));
        return of(...tabEvents);
      }),
    ),
    this._tabEvents$.asObservable(),
  );

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

    tabs.forEach((tabId) => {
      this._tabEvents$.next({
        type: "activated",
        tab: { tabId, url: `https://example.com/${tabId}` },
      });
    });
  }

  updateTab(tabId: number) {
    this._tabEvents$.next({ type: "updated", tab: { tabId, url: `https://example.com/${tabId}` } });
  }

  deactivateTab(tabId: number) {
    this._tabEvents$.next({ type: "deactivated", tabId });
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
