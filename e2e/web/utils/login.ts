import { expect, Page } from "@playwright/test";

import { Account } from "../../utils/credentials";
import { ensureLoggedIn as loginFromLoginPage } from "../../utils/login";
import { VAULT_ROUTE } from "../../utils/routes";

////
// A new account meets two pieces of onboarding on the way to the vault: a page
// pushing the browser extension, and a welcome dialog offering a tour. Both stay
// in the way of anything else the tests want to do, so both are dismissed here.
////

const SETUP_EXTENSION_ROUTE = "#/setup-extension";
const ADD_IT_LATER_TEXT = /^add it later$/i;
const SKIP_TO_WEB_APP_TEXT = /^skip to web app$/i;
const WELCOME_DIALOG_TEXT = /welcome to bitwarden/i;
const SKIP_TOUR_TEXT = /^skip$/i;
const WELCOME_DIALOG_TIMEOUT = 5_000;

export async function ensureLoggedIn(page: Page, account: Account): Promise<void> {
  await loginFromLoginPage(page, account);

  await skipExtensionSetup(page);
  await skipWelcomeTour(page);
}

async function skipWelcomeTour(page: Page): Promise<void> {
  // The dialog has no accessible name of its own, so it is found by its heading.
  const dialog = page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: WELCOME_DIALOG_TEXT }) });

  // Shown once per account, and it can arrive a moment after the vault does.
  try {
    await expect(dialog).toBeVisible({ timeout: WELCOME_DIALOG_TIMEOUT });
  } catch {
    return;
  }

  await dialog.getByRole("button", { name: SKIP_TOUR_TEXT }).click();
  await expect(dialog).toBeHidden();
}

async function skipExtensionSetup(page: Page): Promise<void> {
  if (!page.url().includes(SETUP_EXTENSION_ROUTE)) {
    return;
  }

  // "Add it later" opens a confirmation dialog offering the same skip.
  await page.getByRole("button", { name: ADD_IT_LATER_TEXT }).click();
  await page.getByRole("link", { name: SKIP_TO_WEB_APP_TEXT }).click();

  await expect(page).toHaveURL(VAULT_ROUTE);
}
