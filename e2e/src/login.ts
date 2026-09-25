import { expect, Page } from "@playwright/test";

import { Account, selfHostedUrl } from "./credentials";

/** Whether the client lets the test pick a server before logging in. */
export const ServerChoice = Object.freeze({
  /** Desktop and browser ask which server to use; point them at the account's. */
  Selectable: "selectable",
  /** The web client is built against one server; the selector only picks a region.  */
  Fixed: "fixed",
} as const);
export type ServerChoice = (typeof ServerChoice)[keyof typeof ServerChoice];

const ENV_MENU_TRIGGER = 'environment-selector button[aria-haspopup="menu"]';
const SELF_HOSTED_MENU_ITEM = /self-hosted/i;
const BASE_URL_INPUT = "#self_hosted_env_settings_form_input_base_url";

/**
 * Drives the login screen of any client — the email/password pages are the same
 * shared components (libs/auth/src/angular/login) everywhere.
 */
export class LoginPage {
  constructor(private page: Page) {}

  async logIn(target: Account, serverChoice: ServerChoice) {
    if (serverChoice === ServerChoice.Selectable) {
      await this.useSelfHostedServer(selfHostedUrl(target));
    }

    await this.page.getByTestId("login-email-input").fill(target.email);
    await this.page.getByTestId("login-continue-button").click();

    const password = this.page.getByTestId("login-master-password-input");
    await expect(password).toBeVisible();
    await password.fill(target.password);

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
