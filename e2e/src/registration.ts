import { Locator, Page, Response } from "@playwright/test";

const SIGNUP_PATH = "/#/signup";

const EMAIL_INPUT = "registration-start-email-input";
const NAME_INPUT = "registration-start-name-input";
const CONTINUE_BUTTON = "registration-start-continue-button";
const CHECK_EMAIL_MESSAGE = "registration-start-check-email-message";

const MASTER_PASSWORD_INPUT = "input-password-new-password-input";
const CONFIRM_MASTER_PASSWORD_INPUT = "input-password-new-password-confirm-input";
const CHECK_FOR_BREACHES_CHECKBOX = "input-password-check-for-breaches-checkbox";
const CREATE_ACCOUNT_BUTTON = "input-password-submit-button";

/** Identity endpoint the email step posts to, which sends the verification email. */
const SEND_VERIFICATION_EMAIL_PATH = /\/accounts\/register\/send-verification-email$/;

export type Registrant = {
  email: string;
  name: string;
  password: string;
};

/**
 * Drives the signup screens of any client: the email step and the master password step. Both
 * are the same shared components (libs/angular/src/auth/registration) everywhere.
 */
export class RegistrationPage {
  readonly emailInput: Locator;
  readonly nameInput: Locator;
  readonly continueButton: Locator;
  /** The screen telling the registrant to follow the link mailed to them. */
  readonly checkEmailMessage: Locator;

  readonly masterPasswordInput: Locator;
  readonly confirmMasterPasswordInput: Locator;
  readonly checkForBreachesCheckbox: Locator;
  readonly createAccountButton: Locator;

  constructor(private page: Page) {
    this.emailInput = page.getByTestId(EMAIL_INPUT);
    this.nameInput = page.getByTestId(NAME_INPUT);
    this.continueButton = page.getByTestId(CONTINUE_BUTTON);
    this.checkEmailMessage = page.getByTestId(CHECK_EMAIL_MESSAGE);

    this.masterPasswordInput = page.getByTestId(MASTER_PASSWORD_INPUT);
    this.confirmMasterPasswordInput = page.getByTestId(CONFIRM_MASTER_PASSWORD_INPUT);
    this.checkForBreachesCheckbox = page.getByTestId(CHECK_FOR_BREACHES_CHECKBOX);
    this.createAccountButton = page.getByTestId(CREATE_ACCOUNT_BUTTON);
  }

  /** Opens signup by URL. Web only: desktop and browser reach it from the login page. */
  async open() {
    await this.page.goto(SIGNUP_PATH);
  }

  /**
   * Submits the email step, which asks the server to send a verification email. Resolves with
   * the server's response, so a test can check which server the client sent the email to.
   */
  async start(registrant: Pick<Registrant, "email" | "name">): Promise<Response> {
    await this.emailInput.fill(registrant.email);
    await this.nameInput.fill(registrant.name);

    const response = this.page.waitForResponse((r) =>
      SEND_VERIFICATION_EMAIL_PATH.test(new URL(r.url()).pathname),
    );
    await this.continueButton.click();

    return response;
  }

  /**
   * Sets the master password and creates the account. Skips the breach check, which would
   * send a hash prefix of the password to an external service.
   */
  async finish(password: string) {
    await this.masterPasswordInput.fill(password);
    await this.confirmMasterPasswordInput.fill(password);
    await this.checkForBreachesCheckbox.uncheck();
    await this.createAccountButton.click();
  }
}
