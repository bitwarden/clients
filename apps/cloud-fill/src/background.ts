import type { CredentialSource } from "./credential-source";
import { fillLoginInTab } from "./fill";
import { StaticCredentialSource } from "./static-credential-source";

const credentialSource: CredentialSource = new StaticCredentialSource();

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

/** Fills the active tab. The tab is chosen here; the trigger carries no tab, URL or origin. */
async function fillActiveTab() {
  const tabId = await activeTabId();
  if (tabId == null) {
    return { status: "no_tab" } as const;
  }
  return fillLoginInTab(tabId, credentialSource);
}

// The collect service asks the extension for targeting rules; none are shipped yet.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id === chrome.runtime.id && message?.command === "getUrlAutofillTargetingRules") {
    sendResponse({ result: null });
  }
  return false;
});

(globalThis as unknown as { cloudFill: unknown }).cloudFill = { fillActiveTab };
