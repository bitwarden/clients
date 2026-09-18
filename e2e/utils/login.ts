import { expect, Page } from "@playwright/test";

import { Account } from "./credentials";
import { selectServer } from "./environment";
import { LOGIN_ROUTE, VAULT_ROUTE } from "./routes";

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

  // Every client is hash-routed; leaving the login route means the unlock worked.
  // Clients differ in where they land, so the route itself is asserted by callers.
  await expect(page).not.toHaveURL(LOGIN_ROUTE);
}
