import { Injectable } from "@angular/core";

import { LastPassImportPageFocus } from "@bitwarden/importer-ui";

import { BrowserApi } from "../../../../platform/browser/browser-api";

@Injectable({ providedIn: "root" })
export class BrowserLastPassImportPageFocus implements LastPassImportPageFocus {
  private page: { tabId: number; windowId: number } | undefined;

  async capture(): Promise<void> {
    try {
      const tab = await BrowserApi.getCurrentTab();
      this.page = tab?.id != null ? { tabId: tab.id, windowId: tab.windowId } : undefined;
    } catch {
      // Returning to the page is a courtesy; it must not block the login.
      this.page = undefined;
    }
  }

  restore(): void {
    const page = this.page;
    this.page = undefined;
    if (page == null) {
      return;
    }
    BrowserApi.focusWindow(page.windowId)
      .then(() => BrowserApi.focusTab(page.tabId))
      .catch((): void => undefined);
  }
}
