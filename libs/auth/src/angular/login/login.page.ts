import { Locator, Page } from "@playwright/test";

/** Page object for the web login flow. */
export class LoginPage {
  static readonly route = "/#/login";

  readonly emailInput: Locator;
  readonly continueButton: Locator;
  readonly masterPasswordInput: Locator;
  readonly submitButton: Locator;

  constructor(private readonly page: Page) {
    this.emailInput = page.getByTestId("login-email-input");
    this.continueButton = page.getByTestId("login-continue-button");
    this.masterPasswordInput = page.getByTestId("login-master-password-input");
    this.submitButton = page.getByTestId("login-submit-button");
  }

  async goto(): Promise<void> {
    await this.page.goto(LoginPage.route);
  }

  /** Enters the email and continues to the master-password step. */
  async enterEmail(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.continueButton.click();
  }

  /** Enters the master password and submits. */
  async enterMasterPassword(password: string): Promise<void> {
    await this.masterPasswordInput.fill(password);
    await this.submitButton.click();
  }

  /** Runs the full master-password login flow. */
  async loginWithMasterPassword(email: string, password: string): Promise<void> {
    await this.enterEmail(email);
    await this.enterMasterPassword(password);
  }
}
