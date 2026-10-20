import { test } from "@playwright/test";

import { LoginPage } from "../../../src/login";
import { SETUP_EXTENSION_URL, skipExtensionSetup } from "../../../src/web/onboarding";

const VAULT_URL = /#\/vault/;
const POST_LOGIN_URL = new RegExp(`${VAULT_URL.source}|${SETUP_EXTENSION_URL.source}`);
const POST_LOGIN_TIMEOUT_MS = 60_000;

test("logs into the vault with a master password", async ({ page }) => {
  // Given the user is on the login page
  await page.goto("/");
  const login = new LoginPage(page);

  // When the user logs in with a master password
  await login.logIn();

  // Then the user should be redirected to the vault page, past the extension setup prompt
  await page.waitForURL(POST_LOGIN_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
  await skipExtensionSetup(page);
  await login.waitForVault(VAULT_URL);
});
