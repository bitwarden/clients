import { Page } from "@playwright/test";

/** Starts SSO from the login page, leaving the page on the way to the org's identity provider. */
export async function startSsoLogin(page: Page, email: string, identifier: string) {
  await page.goto("/");
  await page.getByTestId("login-email-input").fill(email);
  await page.getByTestId("login-sso-button").click();

  // A claimed domain fills in the identifier; Mock SAML's example.com is never claimed.
  await page.locator('input[formcontrolname="identifier"]').fill(identifier);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
}
