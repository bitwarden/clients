import { randomUUID } from "node:crypto";

import { expect, Page, test } from "@playwright/test";

import { clientAccounts } from "../../../src/accounts";
import { SsoOrganization, ssoIdentifier } from "../../../src/credentials";
import { MockSamlIdp, mockSamlEmail } from "../../../src/web/mock-saml";
import {
  SETUP_EXTENSION_URL,
  skipExtensionSetup,
  skipOnboardingDialogs,
} from "../../../src/web/onboarding";
import { startSsoLogin } from "../../../src/web/sso-login";

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

/** Signs a new Mock SAML user in to the org's SSO, which provisions their account. */
async function signInNewUser(page: Page, identifier: string): Promise<string> {
  const email = mockSamlEmail();

  await skipOnboardingDialogs(page);
  await startSsoLogin(page, email, identifier);
  await new MockSamlIdp(page).signIn(email);

  return email;
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

test("provisions a master password user through SSO", async ({ page }) => {
  const identifier = identifierOf(SsoOrganization.MasterPassword);

  // Given a user who exists only at the identity provider
  // When they sign in through the org's SSO
  const email = await signInNewUser(page, identifier);

  // Then they are asked to set the master password of their new account
  await page.waitForURL(SET_INITIAL_PASSWORD_URL, { timeout: SSO_TIMEOUT_MS });

  // When they set it
  const password = randomUUID();
  await page.locator('input[formcontrolname="newPassword"]').fill(password);
  await page.locator('input[formcontrolname="newPasswordConfirm"]').fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  // Then they land in their unlocked vault
  await expectUnlockedVault(page, email);
});

test("provisions a trusted device user through SSO", async ({ page }) => {
  const identifier = identifierOf(SsoOrganization.TrustedDevices);

  // Given a user who exists only at the identity provider
  // When they sign in through the org's SSO
  const email = await signInNewUser(page, identifier);

  // Then they are offered to trust this device
  await page.waitForURL(LOGIN_INITIATED_URL, { timeout: SSO_TIMEOUT_MS });

  // Continue renders before the page has loaded the org, and clicked early it fails. The
  // checkbox renders once that load is done.
  await expect(page.getByRole("checkbox", { name: /Remember this device/ })).toBeVisible();

  // When they continue, which creates their keys and trusts the device
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // Then they land in their unlocked vault
  await expectUnlockedVault(page, email);
});
