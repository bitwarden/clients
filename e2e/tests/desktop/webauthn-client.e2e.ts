import { randomUUID } from "node:crypto";

import { mergeTests } from "@playwright/test";

import { automationDriver } from "../../src/automation-driver";
import { account } from "../../src/credentials";
import { expect } from "../../src/desktop/fixtures";
import { lockAll, LockOutcome } from "../../src/desktop/lock";
import { DesktopWebAuthn, test as webAuthnTest } from "../../src/desktop/webauthn";
import { LoginPage, logInToWebVault } from "../../src/login";
import { test as seederTest } from "../../src/seeder/fixtures";
import { seededAccount, SingleUserScene } from "../../src/seeder/scenes/single-user.scene";
import { IS_DEV_SERVER, WEB_VAULT_URL } from "../../src/server";
import { PasskeySettingsPage } from "../../src/web/passkey-settings";
import { useSoftwareAuthenticator } from "../../src/web/software-authenticator-page";
import { TwoFactorSettingsPage } from "../../src/web/two-factor-settings";
import { SoftwareAuthenticator } from "../../src/webauthn/software-authenticator";

const VAULT_URL = /#\/vault/;
const POST_LOGIN_TIMEOUT_MS = 60_000;
const TWO_FACTOR_URL = /#\/2fa/;
const UNLOCK_WITH_PASSKEY_BUTTON = "unlock-with-passkey-button";
const LOGIN_WITH_PASSKEY_BUTTON = "login-with-passkey-button";
const TWO_FACTOR_CONTINUE_BUTTON = "two-factor-webauthn-continue-button";
const TWO_FACTOR_REMEMBER_CHECKBOX = "two-factor-remember-checkbox";
// `EMAIL_TWO_FACTOR_TOKEN_RECORD_DISK_LOCAL` (libs/common/src/auth/services/token.state.ts): the
// "remember me" tokens the server issues, by email.
const TWO_FACTOR_TOKENS = { stateName: "tokenDiskLocal", key: "emailTwoFactorTokenRecord" };

/**
 * The desktop WebAuthn client, with the platform's passkey prompt replaced by the app's automation
 * WebAuthn client (`USE_AUTOMATION_WEBAUTHN`). Everything else is real: the renderer's
 * `navigator.credentials`, the IPC to the main process and its checks, the server's verification
 * of the assertion, and decrypting the vault with the PRF output.
 *
 * Passkeys come from a software authenticator in the test process, registered on the web vault,
 * since the desktop app can't create them.
 */
const test = webAuthnTest;

/** For tests that need their own user, which only a local SeederApi can create; CI skips them. */
const seededTest = mergeTests(webAuthnTest, seederTest);

// Shared by the shared account's runs; removed before each run, e.g. after an aborted one.
const PASSKEY_NAME = "e2e-desktop-prf";

// Test-side shape of `StateCapability` (libs/automation-driver).
type StateCapability = {
  readGlobal(address: { stateName: string; key: string }): Promise<unknown>;
};

test.use({ baseURL: WEB_VAULT_URL, ignoreHTTPSErrors: IS_DEV_SERVER });
seededTest.use({ baseURL: WEB_VAULT_URL, ignoreHTTPSErrors: IS_DEV_SERVER });

test("logs in and unlocks with a passkey registered on the web vault", async ({
  app,
  window,
  webauthn,
  page,
}) => {
  test.setTimeout(300_000);

  // Given a user with a passkey that can decrypt their vault
  const user = account();
  const authenticator = new SoftwareAuthenticator();
  await useSoftwareAuthenticator(page, authenticator);
  await logInToWebVault(page, user);
  const passkeySettings = new PasskeySettingsPage(page);
  await passkeySettings.open();
  await passkeySettings.removeAll(PASSKEY_NAME, user.password);
  await passkeySettings.addWithPrf(PASSKEY_NAME, user.password);

  // When they log in to the desktop app with it
  await webauthn.setEnabled(true);
  const login = new LoginPage(window);
  await login.useServerOf(user);
  await login.logInWithPasskey();
  const loginRequest = await webauthn.approveNext(authenticator);

  // Then the request is for the web vault, and they land in their unlocked vault
  expect(loginRequest.origin).toBe(new URL(WEB_VAULT_URL).origin);
  expect(loginRequest.prf).toBeDefined();
  await window.waitForURL(VAULT_URL, { timeout: POST_LOGIN_TIMEOUT_MS });

  // And when they lock the app, they can unlock it with the same passkey
  const lockedWindow = await lockAll(app, window, LockOutcome.Reload);
  const lockedWebAuthn = new DesktopWebAuthn(lockedWindow);
  await lockedWindow.getByTestId(UNLOCK_WITH_PASSKEY_BUTTON).click();
  const unlockRequest = await lockedWebAuthn.approveNext(authenticator);

  expect(unlockRequest.prf).toBeDefined();
  await expect(lockedWindow).toHaveURL(VAULT_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
});

seededTest(
  "completes WebAuthn two-step login from the app's window, remembering the device",
  async ({ window, webauthn, page, play }) => {
    seededTest.setTimeout(300_000);

    // Given a premium user with WebAuthn two-step login
    const user = await play.scene(
      new SingleUserScene({
        email: "desktop-webauthn-2fa@example.com",
        password: randomUUID(),
        premium: true,
      }),
    );
    const seeded = seededAccount(user);
    const authenticator = new SoftwareAuthenticator();
    await useSoftwareAuthenticator(page, authenticator);
    await logInToWebVault(page, seeded);
    const twoFactorSettings = new TwoFactorSettingsPage(page);
    await twoFactorSettings.open();
    await twoFactorSettings.addWebAuthnKey("e2e-desktop-2fa", seeded.password);

    // When they log in to the desktop app with their master password
    await webauthn.setEnabled(true);
    const state = automationDriver<StateCapability>(window, "state");
    await new LoginPage(window).logIn(seeded);
    await window.waitForURL(TWO_FACTOR_URL, { timeout: POST_LOGIN_TIMEOUT_MS });

    // Then the request waits for Continue, so they can choose to be remembered first
    const continueButton = window.getByTestId(TWO_FACTOR_CONTINUE_BUTTON);
    await expect(continueButton).toBeVisible();
    await window.getByTestId(TWO_FACTOR_REMEMBER_CHECKBOX).check();

    // And a cancelled prompt can be tried again
    await continueButton.click();
    await webauthn.cancelNext();
    await expect(continueButton).toHaveAttribute("data-failed", "true");

    // And approving it opens the vault, and the device is remembered for the next login
    await continueButton.click();
    const request = await webauthn.approveNext(authenticator);
    expect(request.allowCredentials).not.toHaveLength(0);
    await window.waitForURL(VAULT_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
    await expect
      .poll(async () => {
        const tokens = (await state.readGlobal(TWO_FACTOR_TOKENS)) as Record<string, string> | null;
        return tokens?.[seeded.email] != null;
      })
      .toBe(true);
  },
);

test("offers passkey login only while the desktop WebAuthn client is on", async ({
  window,
  webauthn,
}) => {
  const loginWithPasskey = window.getByTestId(LOGIN_WITH_PASSKEY_BUTTON);
  await expect(window.getByTestId("login-email-input")).toBeVisible();

  await webauthn.setEnabled(false);
  await expect(loginWithPasskey).toBeHidden();

  await webauthn.setEnabled(true);
  await expect(loginWithPasskey).toBeVisible();
});
