import { BrowserApi } from "../../platform/browser/browser-api";

import type { FillBrowser } from "./workflow";

/**
 * The browser, as a fill reads it, over `BrowserApi`. A `null` result and a rejection are both
 * `undefined`, so no read rejects.
 */
export const browserFill: FillBrowser = Object.freeze({
  tab: async (tabId: number) => {
    try {
      return (await BrowserApi.getTab(tabId)) ?? undefined;
    } catch {
      return undefined;
    }
  },
  frame: async (tabId: number, frameId: number) => {
    try {
      const frame = await BrowserApi.getFrameDetails({ tabId, frameId });
      return frame ? { documentId: frame.documentId } : undefined;
    } catch {
      return undefined;
    }
  },
  activeTab: async () => {
    try {
      return (await BrowserApi.getTabFromCurrentWindow()) ?? undefined;
    } catch {
      return undefined;
    }
  },
});
