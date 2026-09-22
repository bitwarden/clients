import { expect } from "@playwright/test";

import { BiometricsStatus } from "../../utils/automation-driver";
import { readAccount } from "../../utils/credentials";
import { BIOMETRIC_UNLOCK_TEXT, offersUnlockOption, UnlockOption } from "../../utils/lock-screen";
import { ensureUnlocked } from "../../utils/login";
import { LOCK_ROUTE, VAULT_ROUTE } from "../../utils/routes";
import { Given, Then, When } from "../utils/bdd";
import { disableBiometrics, enableBiometrics, expectBiometrics } from "../utils/biometrics";

Given("I have an unlocked vault as the {string} account", async ({ page }, name: string) => {
  await ensureUnlocked(page, readAccount(name));
});

Given("biometric unlock is enabled", async ({ page, driver }) => {
  // Enrollment reads the hardware status, so it has to look usable first.
  await driver.biometrics.setStatus(BiometricsStatus.Available);
  await enableBiometrics(page, driver);
});

Given("biometric unlock is disabled", async ({ page, driver }) => {
  await driver.biometrics.setStatus(BiometricsStatus.Available);
  await disableBiometrics(page, driver);
});

Given("biometrics are available", async ({ driver }) => {
  await driver.biometrics.setStatus(BiometricsStatus.Available);
});

Given("biometrics are unavailable", async ({ driver }) => {
  await driver.biometrics.setStatus(BiometricsStatus.HardwareUnavailable);
});

Given("the vault is locked", async ({ driver }) => {
  await driver.lockVault();
});

When("I enable biometric unlock", async ({ page, driver }) => {
  await enableBiometrics(page, driver);
});

When("I disable biometric unlock", async ({ page, driver }) => {
  await disableBiometrics(page, driver);
});

When("I unlock with biometrics", async ({ page, driver }) => {
  // The button blocks on the prompt, so approve while the click is pending.
  await page.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT }).click();

  await expect.poll(async () => (await driver.biometrics.listPending()).length).toBeGreaterThan(0);

  await driver.biometrics.approve();
});

When("I click the biometric unlock button", async ({ page }) => {
  // Forced, because this step exists to press the button while it is disabled,
  // which the default actionability wait would sit and time out on.
  await page.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT }).click({ force: true });
});

Then("biometric unlock is enabled", async ({ page, driver }) => {
  await expectBiometrics(page, driver, true);
});

Then("biometric unlock is disabled", async ({ page, driver }) => {
  await expectBiometrics(page, driver, false);
});

Then("the lock screen offers the master password", async ({ page }) => {
  expect(await offersUnlockOption(page, UnlockOption.MasterPassword)).toBe(true);
});

Then("the biometric unlock button is disabled", async ({ page }) => {
  await expect(page.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT })).toBeDisabled();
});

Then("the biometric unlock button is not shown", async ({ page }) => {
  await expect(page.getByRole("button", { name: BIOMETRIC_UNLOCK_TEXT })).toBeHidden();
});

Then("the vault stays locked", async ({ page }) => {
  await expect(page).toHaveURL(LOCK_ROUTE);
});

Then("the vault is shown", async ({ page }) => {
  await expect(page).toHaveURL(VAULT_ROUTE);
});

// Deliberately undefined, so the scenario reports as skipped rather than failing:
//   When I stop requiring the master password on app restart
//   Then the master password is not required on app restart
// That checkbox is Windows-only. See features/security/biometrics.feature.
