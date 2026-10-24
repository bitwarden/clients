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

async function fillActiveTab(expectedOrigin?: string): Promise<FillResult> {
  const tabId = await activeTabId();
  if (tabId == null) {
    return { status: "no_tab" };
  }
  return fillLoginInTab(tabId, credentialSource, expectedOrigin);
}

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
  fill: (expectedOrigin) => fillActiveTab(expectedOrigin),
  defaultRelayUrl: __RELAY_URL__,
  allowInsecureLocal: __TEST_BUILD__,
});
