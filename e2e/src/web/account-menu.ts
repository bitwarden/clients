import { Page } from "@playwright/test";

// The menu trigger is the avatar button in the navigation, which has no accessible name.
const MENU_TRIGGER = "button:has(dynamic-avatar)";

/** Logs out through the account menu in the vault navigation. */
export async function logOut(page: Page) {
  await page.locator(MENU_TRIGGER).first().click();
  await page.getByRole("menuitem", { name: "Log out" }).click();
}

/** Locks through the account menu; only offered when the account has an unlock method. */
export async function lockNow(page: Page) {
  await page.locator(MENU_TRIGGER).first().click();
  await page.getByRole("menuitem", { name: "Lock now" }).click();
}
