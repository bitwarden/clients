import { BrowserContext, Page } from "@playwright/test";

import { extensionShutdown, popupUrl, reopenPopup } from "./fixtures";

// The popup header avatar carries the account as screen-reader text, e.g. "Bitwarden account a@b.c".
const CURRENT_ACCOUNT = /Bitwarden account/;

/** Locks the active account from the popup's account switcher. */
export async function lockNow(popup: Page) {
  await popup.getByRole("button", { name: CURRENT_ACCOUNT }).click();
  await popup.getByRole("button", { name: "Lock now" }).click();
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
