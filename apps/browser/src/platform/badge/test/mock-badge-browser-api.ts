import { BadgeBrowserApi, RawBadgeState } from "../badge-browser-api";

export class MockBadgeBrowserApi implements BadgeBrowserApi {
  specificStates: Record<number, RawBadgeState> = {};
  generalState?: RawBadgeState;
  tabs: number[] = [];

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
