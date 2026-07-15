import { expect } from "@wdio/globals";

import { environmentSelectorPage } from "@bitwarden/angular/auth/environment-selector/environment-selector.page";
import { loginPage } from "@bitwarden/auth/src/angular/login/login.page";

import { introCarouselPage } from "../../src/vault/popup/components/vault/intro-carousel/intro-carousel.page";
import { vaultPage } from "../../src/vault/popup/components/vault/vault.page";
import { openPopup } from "../support/open-popup";

describe("Browser vault smoke", () => {
  let email: string;
  let password: string;
  let serverUrl: string;

  before(async () => {
    const envEmail = process.env.TEST_ACCOUNT_EMAIL;
    const envPassword = process.env.TEST_ACCOUNT_PASSWORD;
    if (!envEmail || !envPassword) {
      throw new Error(
        "TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD must be set in apps/browser/test/.env",
      );
    }
    email = envEmail;
    password = envPassword;
    serverUrl = process.env.BW_SERVER_URL!;
  });

  it("signs in and lands on the vault", async () => {
    await openPopup(
      "#/login",
      async () =>
        (await environmentSelectorPage.root.isExisting()) ||
        (await introCarouselPage.root.isExisting()) ||
        (await loginPage.emailInput.isExisting()),
    );

    await introCarouselPage.skipIfPresent();
    // The dev build bakes a `managedEnvironment` devFlag pointing at localhost; selecting the target
    // server here via the login env-selector overrides it so the test runs against BW_SERVER_URL.
    await environmentSelectorPage.selectSelfHosted(serverUrl);
    await loginPage.login(email, password);

    await vaultPage.waitForDisplayed();
    await expect(vaultPage.root).toBeDisplayed();
  });
});
