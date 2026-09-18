import { expect, Page } from "@playwright/test";

import { Account } from "./credentials";
import { selectServer } from "./environment";

const VAULT_ROUTE = /#\/vault/;

/**
 * Logs in with a master password, configuring the account's server first. Tests
 * share one app instance, so this is a no-op once some earlier test has logged in.
 */
export async function ensureLoggedIn(page: Page, account: Account): Promise<void> {
  if (VAULT_ROUTE.test(page.url())) {
    return;
  }

  if (account.server != null) {
    await selectServer(page, account.server);
  }

  await page.getByTestId("login-email-input").fill(account.email);
  await page.getByTestId("login-continue-button").click();

  await page.getByTestId("login-master-password-input").fill(account.password);
  await page.getByTestId("login-submit-button").click();

  // The desktop app is a hash-routed file:// page; the vault route means unlocked.
  await expect(page).toHaveURL(VAULT_ROUTE);
}
