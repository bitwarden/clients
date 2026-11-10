import { Page } from "@playwright/test";

// The avatar button in the navigation; rendered once each for the expanded and collapsed nav.
const MENU_TRIGGER = "account-menu-button";
const LOCK_NOW_ITEM = "account-menu-lock-now-button";
const LOG_OUT_ITEM = "account-menu-log-out-button";

/** Logs out through the account menu in the vault navigation. */
export async function logOut(page: Page) {
  await page.getByTestId(MENU_TRIGGER).first().click();
  await page.getByTestId(LOG_OUT_ITEM).click();
}

/** Locks through the account menu; only offered when the account has an unlock method. */
export async function lockNow(page: Page) {
  await page.getByTestId(MENU_TRIGGER).first().click();
  await page.getByTestId(LOCK_NOW_ITEM).click();
}
