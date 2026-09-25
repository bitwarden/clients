import { expect, test } from "@playwright/test";

import { AccountName, account } from "../../src/credentials";
import { LoginPage, ServerChoice } from "../../src/login";
import { logOut } from "../../src/web/account-menu";
import {
  SETUP_EXTENSION_URL,
  skipExtensionSetup,
  skipOnboardingDialogs,
} from "../../src/web/onboarding";
import { PasskeySettingsPage } from "../../src/web/passkey-settings";
import { VirtualAuthenticator } from "../../src/web/virtual-authenticator";

const VAULT_URL = /#\/vault/;
const LOGIN_URL = /#\/login/;
const POST_LOGIN_URL = new RegExp(`${VAULT_URL.source}|${SETUP_EXTENSION_URL.source}`);
const POST_LOGIN_TIMEOUT_MS = 60_000;

const PASSKEY_NAME = "e2e-prf";

test("logs in with a PRF passkey added in settings", async ({ page }) => {
  const user = account(AccountName.Local);
  const authenticator = await VirtualAuthenticator.attach(page);
  const login = new LoginPage(page);
  const settings = new PasskeySettingsPage(page);
  await skipOnboardingDialogs(page);

  // Log in with the master password and register the passkey.
  await page.goto("/");
  await login.logIn(user, ServerChoice.Fixed);
  await page.waitForURL(POST_LOGIN_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
  await skipExtensionSetup(page);

  await settings.open();
  await settings.removeAll(PASSKEY_NAME, user.password);
  await settings.addWithPrf(PASSKEY_NAME, user.password);

  await logOut(page);
  await page.waitForURL(LOGIN_URL);

  // The PRF output decrypts the user key, so the vault opens without a master password.
  await login.logInWithPasskey();
  await page.waitForURL(POST_LOGIN_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
  await skipExtensionSetup(page);
  await login.waitForVault(VAULT_URL);
  await expect(page.getByTestId("login-master-password-input")).toBeHidden();

  // The virtual authenticator dies with the test; drop its server-side twin.
  await settings.open();
  await settings.removeAll(PASSKEY_NAME, user.password);
  await authenticator.detach();
});
