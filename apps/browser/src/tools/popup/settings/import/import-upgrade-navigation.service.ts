import { Injectable } from "@angular/core";

import { BrowserApi } from "../../../../platform/browser/browser-api";

/**
 * Opens the new import picker in its own extension tab immediately, no confirmation — the picker
 * doesn't fit inside the extension popup. Shared by every entry point into the extension's import
 * flow so the URL lives in one place.
 */
@Injectable({ providedIn: "root" })
export class ImportUpgradeNavigationService {
  async openImportSourceSelectTab(): Promise<void> {
    // `?uilocation=tab` is required, not cosmetic: `BrowserPopupUtils.inPopup()` treats any URL
    // with no `uilocation` param as a real popup, and `PopupRouterCacheService` only records/skips
    // route history for URLs `inPopup()` considers a popup — without this marker, opening this tab
    // would pollute the toolbar popup's cached "last route" and hijack its next open.
    const url =
      BrowserApi.getRuntimeURL("popup/index.html#/import-source-select") + "?uilocation=tab";
    await BrowserApi.createNewTab(url);
  }
}
