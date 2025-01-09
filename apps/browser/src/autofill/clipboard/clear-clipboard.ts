// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BrowserApi } from "../../platform/browser/browser-api";

export class ClearClipboard {
  /**
    We currently rely on an active tab with an injected content script (`../content/misc-utils.ts`) to clear the clipboard via `window.navigator.clipboard.writeText(text)`

    With https://bugs.chromium.org/p/chromium/issues/detail?id=1160302 it was said that service workers,
    would have access to the clipboard api and then we could migrate to a simpler solution
    */
  static async run() {
    const activeTabs = await BrowserApi.getActiveTabs();
    if (!activeTabs || activeTabs.length === 0) {
      return;
    }

    BrowserApi.sendTabsMessage(activeTabs[0].id, {
      command: "clearClipboard",
    });
  }
}
