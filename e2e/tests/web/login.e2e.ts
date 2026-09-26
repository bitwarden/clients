import { expect, test } from "@playwright/test";

import { AccountName, account } from "../../src/credentials";
import { LoginPage, ServerChoice } from "../../src/login";
import { SETUP_EXTENSION_URL, skipExtensionSetup } from "../../src/web/onboarding";

const VAULT_URL = /#\/vault/;
const POST_LOGIN_URL = new RegExp(`${VAULT_URL.source}|${SETUP_EXTENSION_URL.source}`);
const POST_LOGIN_TIMEOUT_MS = 60_000;

test("logs into the vault with a master password", async ({ page }) => {
  await page.goto("/");

  const login = new LoginPage(page);
  await login.logIn(account(AccountName.Local), ServerChoice.Fixed);

  await page.waitForURL(POST_LOGIN_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
  await skipExtensionSetup(page);
  await login.waitForVault(VAULT_URL);

  await expect(page.getByTestId("login-master-password-input")).toBeHidden();
});
