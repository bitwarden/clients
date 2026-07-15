import { browser, expect } from "@wdio/globals";

import { loginPage } from "@bitwarden/auth/src/angular/login/login.page";

import { vaultPage } from "../../src/app/vault/individual-vault/vault.page";

describe("Web vault smoke", () => {
  let email: string;
  let password: string;

  before(() => {
    const envEmail = process.env.TEST_ACCOUNT_EMAIL;
    const envPassword = process.env.TEST_ACCOUNT_PASSWORD;
    if (!envEmail || !envPassword) {
      throw new Error(
        "TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD must be set in apps/web/test/.env",
      );
    }
    email = envEmail;
    password = envPassword;
  });

  it("logs in, skips onboarding, and lands on the vault", async () => {
    await browser.url("/#/login");
    await loginPage.login(email, password);

    await vaultPage.dismissOnboardingGates();
    await vaultPage.waitForReady();

    await expect(vaultPage.vaultItems).toBeDisplayed();
  });
});
