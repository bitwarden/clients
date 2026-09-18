import { expect, Page } from "@playwright/test";

import { LOGIN_ROUTE } from "../../utils/routes";

////
// SSO login against the dev SAML IdP (simplesamlphp on :8090), which the local
// server stack ships for exactly this purpose.
////

const SSO_ROUTE = /#\/sso/;
const IDP_HOST = /localhost:8090/;
const IDP_USERNAME_INPUT = 'input[name="username"]';
const IDP_PASSWORD_INPUT = 'input[name="password"]';
const IDP_SUBMIT = 'button[type="submit"], input[type="submit"]';
const IDENTIFIER_INPUT = 'input[formcontrolname="identifier"]';
const CONTINUE_TEXT = /^continue$/i;

export type IdpUser = {
  /** Email the org knows the member by, entered on the Bitwarden login page. */
  email: string;
  /** Credentials the IdP knows, from the dev stack's `authsources.php`. */
  username: string;
  password: string;
};

/**
 * Drives the client through SSO up to the point where the server has
 * authenticated the user. Where that lands depends on the org's member
 * decryption option, so callers take it from there.
 */
export async function loginViaSso(page: Page, identifier: string, user: IdpUser): Promise<void> {
  await page.goto("/");
  await expect(page).toHaveURL(LOGIN_ROUTE);

  await page.getByTestId("login-email-input").fill(user.email);
  await page.getByTestId("login-sso-button").click();

  await expect(page).toHaveURL(SSO_ROUTE);
  await page.locator(IDENTIFIER_INPUT).fill(identifier);
  await page.getByRole("button", { name: CONTINUE_TEXT }).click();

  await page.waitForURL(IDP_HOST);
  await page.locator(IDP_USERNAME_INPUT).fill(user.username);
  await page.locator(IDP_PASSWORD_INPUT).fill(user.password);
  await page.locator(IDP_SUBMIT).first().click();
}
