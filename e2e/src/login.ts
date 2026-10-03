import { expect, Page } from "@playwright/test";

import { account } from "./credentials";

// Desktop and browser share a button-triggered selector that offers self-hosted. Web's
// selector is a link that only switches region, since its server is baked into the build.
const ENV_MENU_TRIGGER = 'environment-selector button[aria-haspopup="menu"]';
const SELF_HOSTED_MENU_ITEM = /self-hosted/i;
const BASE_URL_INPUT = "#self_hosted_env_settings_form_input_base_url";

/**
 * Drives the login screen of any client — the email/password pages are the same
 * shared components (libs/auth/src/angular/login) everywhere.
 */
export class LoginPage {
  constructor(private page: Page) {}

  async logIn() {
    const targetAccount = account();

    // Wait for the page before probing for the selector, which renders alongside it.
    const email = this.page.getByTestId("login-email-input");
    await expect(email).toBeVisible();

    // On desktop and browser, the self-hosted server is not the default; switch to it if needed.
    if ((await this.page.locator(ENV_MENU_TRIGGER).count()) > 0) {
      await this.useSelfHostedServer(targetAccount.server);
    }

    await email.fill(targetAccount.email);
    await this.page.getByTestId("login-continue-button").click();

    const password = this.page.getByTestId("login-master-password-input");
    await expect(password).toBeVisible();
    await password.fill(targetAccount.password);

    await this.page.getByTestId("login-submit-button").click();
  }

  /** Starts a passkey login; an authenticator must be ready to answer the assertion. */
  async logInWithPasskey() {
    await this.page.getByTestId("login-with-passkey-button").click();
  }

  /** Vault route the client lands on once the master password is accepted. */
  async waitForVault(vaultUrl: RegExp) {
    await this.page.waitForURL(vaultUrl, { timeout: 60_000 });
  }

  private async useSelfHostedServer(baseUrl: string) {
    await this.page.locator(ENV_MENU_TRIGGER).click();
    await this.page.getByRole("menuitem", { name: SELF_HOSTED_MENU_ITEM }).click();

    const input = this.page.locator(BASE_URL_INPUT);
    await expect(input).toBeVisible();
    await input.fill(baseUrl);

    await this.page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(input).toBeHidden();
  }
}
