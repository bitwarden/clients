import { randomUUID } from "node:crypto";

import { expect } from "@playwright/test";

import { LoginPage, logInToWebVault } from "../../src/login";
import { test } from "../../src/seeder/fixtures";
import { seededAccount, SingleUserScene } from "../../src/seeder/scenes/single-user.scene";
import { logOut } from "../../src/web/account-menu";
import { SETUP_EXTENSION_URL, skipExtensionSetup } from "../../src/web/onboarding";
import { TwoFactorSettingsPage } from "../../src/web/two-factor-settings";
import { VirtualAuthenticator } from "../../src/web/virtual-authenticator";

const VAULT_URL = /#\/vault/;
const TWO_FACTOR_URL = /#\/2fa/;
const POST_LOGIN_TIMEOUT_MS = 60_000;

/**
 * WebAuthn two-step login on the web vault, which runs the request in the web vault's
 * WebAuthn connector in an iframe. Clients that run it in their own window instead (the
 * desktop app) don't change this path.
 */
test("logs in with WebAuthn two-step login through the connector iframe", async ({
  page,
  play,
}) => {
  test.setTimeout(180_000);

  // Given a premium user, since WebAuthn two-step login is a premium feature
  const user = await play.scene(
    new SingleUserScene({
      email: "webauthn-2fa@example.com",
      password: randomUUID(),
      premium: true,
    }),
  );
  const account = seededAccount(user);
  await VirtualAuthenticator.attach(page);

  // who has turned on WebAuthn two-step login with a security key
  await logInToWebVault(page, account);
  const settings = new TwoFactorSettingsPage(page);
  await settings.open();
  await settings.addWebAuthnKey("e2e-2fa-key", account.password);
  await logOut(page);

  // When they log in with their master password
  await page.goto("/");
  await new LoginPage(page).logIn(account);

  // Then they're asked for the second step, the connector starts the request on its own,
  // and the key's answer completes the login
  await page.waitForURL(TWO_FACTOR_URL);
  await expect(page.locator("#webauthn_iframe")).toBeAttached();
  await page.waitForURL(new RegExp(`${VAULT_URL.source}|${SETUP_EXTENSION_URL.source}`), {
    timeout: POST_LOGIN_TIMEOUT_MS,
  });
  await skipExtensionSetup(page);
  await expect(page).toHaveURL(VAULT_URL);
});
