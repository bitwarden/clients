import { randomUUID } from "node:crypto";

import { expect, Page, test } from "@playwright/test";

import { clientAccounts } from "../../../src/accounts";
import { SsoOrganization, ssoIdentifier } from "../../../src/credentials";
import { LockScreen } from "../../../src/lock-screen";
import { logOut } from "../../../src/web/account-menu";
import { MockSamlIdp, mockSamlEmail } from "../../../src/web/mock-saml";
import {
  SETUP_EXTENSION_URL,
  skipExtensionSetup,
  skipOnboardingDialogs,
} from "../../../src/web/onboarding";
import { startSsoLogin } from "../../../src/web/sso-login";

const LOGIN_URL = /#\/login/;
const VAULT_URL = /#\/vault/;
const POST_LOGIN_URL = new RegExp(`${VAULT_URL.source}|${SETUP_EXTENSION_URL.source}`);
const SET_INITIAL_PASSWORD_URL = /#\/set-initial-password/;
const LOGIN_INITIATED_URL = /#\/login-initiated/;
const SSO_TIMEOUT_MS = 60_000;

/** The org's SSO identifier, skipping the test when this run has none configured. */
function identifierOf(org: SsoOrganization): string {
  const identifier = ssoIdentifier(org);
  test.skip(identifier == null, `No SSO identifier for "${org}", see e2e/README.md.`);

  return identifier!;
}

/** Signs a Mock SAML user in to the org's SSO. The first sign-in provisions their account. */
async function ssoSignIn(page: Page, identifier: string, email: string) {
  await skipOnboardingDialogs(page);
  await startSsoLogin(page, email, identifier);
  await new MockSamlIdp(page).signIn(email);
}

/**
 * Logs out of the vault, back to the login page. Also ends the SSO server's session, a cookie
 * the vault's logout leaves behind, so the next sign-in goes through the IdP again.
 */
async function logOutOfVault(page: Page) {
  await logOut(page);
  await page.waitForURL(LOGIN_URL);
  await page.context().clearCookies();
}

/** Waits for the vault, past the extension pitch, with `email` unlocked in it. */
async function expectUnlockedVault(page: Page, email: string) {
  await page.waitForURL(POST_LOGIN_URL, { timeout: SSO_TIMEOUT_MS });
  await skipExtensionSetup(page);
  await expect(page).toHaveURL(VAULT_URL);

  await expect
    .poll(() => clientAccounts(page))
    .toContainEqual(expect.objectContaining({ email, status: "Unlocked" }));
}

test("logs in through SSO as a provisioned master password user", async ({ page }) => {
  const identifier = identifierOf(SsoOrganization.MasterPassword);

  // Given a user provisioned by signing in through the org's SSO and setting a master password
  const email = mockSamlEmail();
  await ssoSignIn(page, identifier, email);
  await page.waitForURL(SET_INITIAL_PASSWORD_URL, { timeout: SSO_TIMEOUT_MS });

  const password = randomUUID();
  await page.locator('input[formcontrolname="newPassword"]').fill(password);
  await page.locator('input[formcontrolname="newPasswordConfirm"]').fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expectUnlockedVault(page, email);
  await logOutOfVault(page);

  // When they sign in through SSO again
  await ssoSignIn(page, identifier, email);

  // Then their master password unlocks the vault
  const lockScreen = new LockScreen(page);
  await lockScreen.waitUntilShown();
  await lockScreen.unlockWithMasterPassword(password);
  await expectUnlockedVault(page, email);
});

test("logs in through SSO as a provisioned trusted device user", async ({ page }) => {
  const identifier = identifierOf(SsoOrganization.TrustedDevices);

  // Given a user provisioned by signing in through the org's SSO and trusting this device
  const email = mockSamlEmail();
  await ssoSignIn(page, identifier, email);
  await page.waitForURL(LOGIN_INITIATED_URL, { timeout: SSO_TIMEOUT_MS });

  // Continue renders before the page has loaded the org, and clicked early it fails. The
  // checkbox renders once that load is done.
  await expect(page.getByRole("checkbox", { name: /Remember this device/ })).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expectUnlockedVault(page, email);
  await logOutOfVault(page);

  // When they sign in through SSO again
  await ssoSignIn(page, identifier, email);

  // Then the trusted device unlocks the vault
  await expectUnlockedVault(page, email);
});
