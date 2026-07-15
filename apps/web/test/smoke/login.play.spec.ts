import { expect, test } from "@playwright/test";

import { LoginPage } from "../../../../libs/auth/src/angular/login/login.page";
import { VaultPage } from "../../src/app/vault/individual-vault/vault.page";

test("logs in, skips onboarding, and lands on the vault", async ({ page }) => {
  const email = process.env.TEST_ACCOUNT_EMAIL;
  const password = process.env.TEST_ACCOUNT_PASSWORD;
  test.skip(
    !email || !password,
    "Set TEST_ACCOUNT_EMAIL and TEST_ACCOUNT_PASSWORD in apps/web/test/.env",
  );

  const login = new LoginPage(page);
  await login.goto();
  await login.loginWithMasterPassword(email!, password!);

  const vault = new VaultPage(page);
  await vault.dismissOnboardingGates();
  await vault.waitForReady();

  await expect(vault.vaultItems).toBeVisible();
});
