import { HashLocationStrategy, LocationChangeListener } from "@angular/common";
import { Injectable } from "@angular/core";

import { BrowserApi } from "../../browser/browser-api";
import BrowserPopupUtils from "../../browser/browser-popup-utils";

type HistoryEntry = { path: string; state: unknown };

/**
 * Keeps the Safari toolbar popup's browser history at a single entry.
 *
 * WebKit only honours `window.close()` on a window that script did not open while its
 * back/forward list holds at most one entry. Each router navigation normally pushes an entry,
 * so once the popup has navigated (or replayed its cached route history), `BrowserApi.closePopup`
 * is silently ignored and the popup stays open after autofill.
 *
 * This strategy turns every push into a replace and keeps its own stack of the replaced entries,
 * so `Location.back()` and `Location.historyGo(-n)` still return to earlier pages.
 */
@Injectable()
export class SafariPopupLocationStrategy extends HashLocationStrategy {
  private readonly entries: HistoryEntry[] = [];
  private readonly popStateListeners: LocationChangeListener[] = [];

  override onPopState(fn: LocationChangeListener): void {
    this.popStateListeners.push(fn);
    super.onPopState(fn);
  }

  override pushState(state: unknown, title: string, path: string, queryParams: string): void {
    this.entries.push({ path: this.path(true), state: this.getState() });
    this.replaceState(state, title, path, queryParams);
  }

  override back(): void {
    this.historyGo(-1);
  }

  override historyGo(relativePosition = 0): void {
    const steps = -relativePosition;
    if (steps <= 0 || steps > this.entries.length) {
      // Not a step back through entries this strategy recorded, e.g. an entry added directly with
      // `history.pushState`. Leave it to the browser.
      super.historyGo(relativePosition);
      return;
    }

    const target = this.entries.splice(this.entries.length - steps)[0];
    this.replaceState(target.state, "", target.path, "");

    // The router only follows `popstate` events, which a replace does not fire.
    for (const listener of this.popStateListeners) {
      listener({ type: "popstate", state: target.state });
    }
  }

  override ngOnDestroy(): void {
    this.popStateListeners.length = 0;
    super.ngOnDestroy();
  }
}

/**
 * Whether the current view is the Safari toolbar popup, the only view that needs
 * {@link SafariPopupLocationStrategy}. Popouts are closed with `BrowserApi.removeWindow` instead.
 */
export function needsSafariPopupLocationStrategy(win: Window): boolean {
  return BrowserApi.isSafariApi && BrowserPopupUtils.inPopup(win);
}
