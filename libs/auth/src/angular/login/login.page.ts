import { $ } from "@wdio/globals";

/** Page object for the web login flow. */
class LoginPage {
  get emailInput() {
    return $('[data-testid="login-email-input"]');
  }

  get continueButton() {
    return $('[data-testid="login-continue-button"]');
  }

  get masterPasswordInput() {
    return $('[data-testid="login-master-password-input"]');
  }

  get submitButton() {
    return $('[data-testid="login-submit-button"]');
  }

  async login(email: string, password: string): Promise<void> {
    await this.emailInput.setValue(email);
    await this.continueButton.click();

    await this.masterPasswordInput.setValue(password);
    await this.submitButton.click();
  }
}

export const loginPage = new LoginPage();
