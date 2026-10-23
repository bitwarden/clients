import type { CredentialSource } from "./credential-source";
import { fillLoginInTab } from "./fill";
import type { FillResult } from "./messages";
import { startNativeChannel } from "./native-channel";
import { RelayCredentialSource } from "./relay-credential-source";
import { StaticCredentialSource } from "./static-credential-source";

const credentialSource: CredentialSource =
  __CREDENTIAL_SOURCE__ === "static" ? new StaticCredentialSource() : new RelayCredentialSource();

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  return tab?.id;
}

/** Fills the active tab. The tab is chosen here; the trigger carries no tab, URL or origin. */
async function fillActiveTab(): Promise<FillResult> {
  const tabId = await activeTabId();
  if (tabId == null) {
    return { status: "no_tab" };
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

if (__TEST_BUILD__) {
  (globalThis as unknown as { cloudFill: unknown }).cloudFill = { fillActiveTab };
}

startNativeChannel({
  fill: fillActiveTab,
  defaultRelayUrl: __RELAY_URL__,
  allowInsecureLocal: __TEST_BUILD__,
});
