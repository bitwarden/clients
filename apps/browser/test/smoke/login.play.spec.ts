import { EnvironmentSelectorPage } from "../../../../libs/angular/src/auth/environment-selector/environment-selector.page";
import { LoginPage } from "../../../../libs/auth/src/angular/login/login.page";
import { IntroCarouselPage } from "../../src/vault/popup/components/vault/intro-carousel/intro-carousel.page";
import { PopupVaultPage } from "../../src/vault/popup/components/vault/vault.page";
import { expect, test } from "../support/extension.fixture";

test("signs in and lands on the vault", async ({ openPopup }) => {
  const email = process.env.TEST_ACCOUNT_EMAIL;
  const password = process.env.TEST_ACCOUNT_PASSWORD;
  const serverUrl = process.env.BW_SERVER_URL ?? "https://localhost:8080";
  test.skip(
    !email || !password,
    "Set TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD in apps/browser/test/.env",
  );

  const page = await openPopup(
    "#/login",
    async (p) =>
      (await new EnvironmentSelectorPage(p).root.count()) > 0 ||
      (await new IntroCarouselPage(p).root.count()) > 0 ||
      (await new LoginPage(p).emailInput.count()) > 0,
  );

  await new IntroCarouselPage(page).skipIfPresent();
  // The dev build bakes a `managedEnvironment` devFlag pointing at localhost; selecting the target
  // server here via the login env-selector overrides it so the test runs against BW_SERVER_URL.
  await new EnvironmentSelectorPage(page).selectSelfHosted(serverUrl);
  await new LoginPage(page).loginWithMasterPassword(email!, password!);

  const vault = new PopupVaultPage(page);
  await vault.waitForDisplayed();
  await expect(vault.root).toBeVisible();
});
