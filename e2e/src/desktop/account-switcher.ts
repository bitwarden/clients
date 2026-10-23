import { Page } from "@playwright/test";

// The trigger is the active account's avatar, labelled with a name the test does not know.
const SWITCHER_TRIGGER = "app-account-switcher-v2 button:has(bit-avatar)";

/** Opens the account switcher menu in the header and signs in another account from it. */
export async function addAccount(window: Page) {
  await window.locator(SWITCHER_TRIGGER).first().click();
  await window.getByRole("menuitem", { name: "Add account" }).click();
}

/** Switches to the inactive account `email` from the header's account switcher. */
export async function switchAccount(window: Page, email: string) {
  await window.locator(SWITCHER_TRIGGER).first().click();
  await window.getByRole("menuitem", { name: new RegExp(escape(email)) }).click();
}

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
