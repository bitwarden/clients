import { Page } from "@playwright/test";

import { lockNow } from "../../src/browser/account-switcher";
import {
  expect,
  extensionShutdown,
  popupUrl,
  reachLoginPage,
  reopenPopup,
  test,
} from "../../src/browser/fixtures";
import { Account, AccountName, account } from "../../src/credentials";
import { LockScreen } from "../../src/lock-screen";
import { LoginPage, ServerChoice } from "../../src/login";
import {
  SETUP_EXTENSION_URL,
  skipExtensionSetup,
  skipOnboardingDialogs,
} from "../../src/web/onboarding";
import { PasskeySettingsPage } from "../../src/web/passkey-settings";
import { VirtualAuthenticator } from "../../src/web/virtual-authenticator";

/**
 * A passkey registered on the web vault unlocks the browser extension.
 *
 *   tab 1: web vault ──► register PRF passkey ─────────────────────► popup ──► unlock with passkey
 *   tab 2:                                     popup ──► log in ──► lock
 *
 * Virtual authenticators belong to a tab and their PRF secrets cannot be exported, so the
 * passkey is registered and used in one tab. Lock closes every extension view, so login and
 * lock happen in a second tab, and the first reopens the popup afterwards. The extension
 * asserts for the rpId of its environment's web vault ("localhost"), the one registered for.
 */

const WEB_VAULT_ROUTE = /#\/vault/;
const POST_LOGIN_URL = new RegExp(`${WEB_VAULT_ROUTE.source}|${SETUP_EXTENSION_URL.source}`);
const POST_LOGIN_TIMEOUT_MS = 60_000;
// The popup redirects to a tab route (/tabs/vault or /tabs/current) once unlocked.
const EXTENSION_VAULT_URL = /#\/tabs\//;
const LOCK_URL = /#\/lock/;

const PASSKEY_NAME = "e2e-shared-prf";
const UNLOCK_WITH_PASSKEY = "Unlock with passkey";

async function logInToWebVault(page: Page, user: Account) {
  await skipOnboardingDialogs(page);
  await page.goto("/");
  await new LoginPage(page).logIn(user, ServerChoice.Fixed);
  await page.waitForURL(POST_LOGIN_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
  await skipExtensionSetup(page);
}

test("unlocks the extension with a passkey registered on the web vault", async ({ context }) => {
  test.setTimeout(300_000);

  const user = account(AccountName.Local);
  const tab = await context.newPage();
  const authenticator = await VirtualAuthenticator.attach(tab);

  // 1. Register a passkey with vault encryption on the web vault.
  await logInToWebVault(tab, user);
  const webSettings = new PasskeySettingsPage(tab);
  await webSettings.open();
  await webSettings.removeAll(PASSKEY_NAME, user.password);
  await webSettings.addWithPrf(PASSKEY_NAME, user.password);

  // 2. Log in on the extension in a second tab.
  const popup = await popupUrl(context);
  const extension = await context.newPage();
  await extension.goto(popup);
  await reachLoginPage(extension);
  const extensionLogin = new LoginPage(extension);
  await extensionLogin.logIn(user, ServerChoice.Selectable);
  await extensionLogin.waitForVault(EXTENSION_VAULT_URL);

  // 3. Lock. That restarts the extension and closes its views; the web tab and its authenticator survive.
  const shutdown = extensionShutdown(context);
  await lockNow(extension);
  await shutdown;

  // 4. Reopen the popup in the authenticator's tab and unlock with the passkey.
  await reopenPopup(context, popup, tab);
  await tab.waitForURL(LOCK_URL);
  const lockScreen = new LockScreen(tab);
  await lockScreen.waitUntilShown();

  await tab.getByRole("button", { name: UNLOCK_WITH_PASSKEY }).click();
  await tab.waitForURL(EXTENSION_VAULT_URL, { timeout: POST_LOGIN_TIMEOUT_MS });
  await lockScreen.waitUntilGone();

  // The virtual authenticator dies with the test; drop its server-side twin.
  await authenticator.detach();
  const cleanup = await context.newPage();
  await logInToWebVault(cleanup, user);
  const cleanupSettings = new PasskeySettingsPage(cleanup);
  await cleanupSettings.open();
  await cleanupSettings.removeAll(PASSKEY_NAME, user.password);
  await expect(cleanup.getByText(PASSKEY_NAME)).toHaveCount(0);
});
