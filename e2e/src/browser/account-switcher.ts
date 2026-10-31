import { BrowserContext, Page } from "@playwright/test";

import { extensionShutdown, popupUrl, reopenPopup } from "./fixtures";

// The popup header avatar, which opens the account switcher.
export const CURRENT_ACCOUNT_BUTTON = "current-account-button";
const LOCK_NOW_BUTTON = "account-switcher-lock-now-button";

/** Locks the active account from the popup's account switcher. */
export async function lockNow(popup: Page) {
  await popup.getByTestId(CURRENT_ACCOUNT_BUTTON).click();
  await popup.getByTestId(LOCK_NOW_BUTTON).click();
}

/**
 * Locks, then reopens the popup, as a user clicking the toolbar icon again would: locking
 * closes every popup and restarts the extension to wipe it from memory.
 */
export async function lockAndReopen(context: BrowserContext, popup: Page): Promise<Page> {
  const url = await popupUrl(context);
  const shutdown = extensionShutdown(context);
  await lockNow(popup);
  await shutdown;

  return reopenPopup(context, url);
}
