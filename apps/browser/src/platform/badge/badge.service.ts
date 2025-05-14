import { BrowserApi } from "../browser/browser-api";

import { BadgeState } from "./state";

export class BadgeService {
  private badgeAction: typeof chrome.action | typeof chrome.browserAction;
  private sidebarAction: OperaSidebarAction | FirefoxSidebarAction;
  private win: Window & typeof globalThis;

  constructor(win: Window & typeof globalThis) {
    this.badgeAction = BrowserApi.getBrowserAction();
    this.sidebarAction = BrowserApi.getSidebarAction(self);
    this.win = win;

    (win as any).badgeService = this;
  }

  async setState(name: string, state: BadgeState) {}

  async clearState(name: string) {}
}
