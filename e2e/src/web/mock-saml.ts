import { randomUUID } from "node:crypto";

import { Page } from "@playwright/test";

/** Mock SAML (https://mocksaml.com), a public SAML IdP that signs in any user without checks. */
const MOCK_SAML_URL = /^https:\/\/mocksaml\.com\//;

/** One of the domains its login form offers; the user part is free. */
const MOCK_SAML_DOMAIN = "example.com";

const IDP_TIMEOUT_MS = 60_000;

/** A fresh Mock SAML user, which SSO provisions as a new account just in time. */
export function mockSamlEmail(): string {
  return `e2e-${randomUUID()}@${MOCK_SAML_DOMAIN}`;
}

/** Drives Mock SAML's login form, which the org's SSO redirects to. */
export class MockSamlIdp {
  constructor(private page: Page) {}

  /** Signs in as `email`, an address on `MOCK_SAML_DOMAIN`. Any password works. */
  async signIn(email: string) {
    const [username, domain] = email.split("@");
    if (domain !== MOCK_SAML_DOMAIN) {
      throw new Error(`Mock SAML only signs in @${MOCK_SAML_DOMAIN} users, not ${email}.`);
    }

    await this.page.waitForURL(MOCK_SAML_URL, { timeout: IDP_TIMEOUT_MS });
    await this.page.locator("#username").fill(username);
    await this.page.locator("#domain").selectOption(domain);
    await this.page.getByRole("button", { name: "Sign In" }).click();
  }
}
