import { expect, test } from "@playwright/test";

import { AutomationDriver, BiometricsStatus } from "../../utils/automation-driver";
import { AttachedApp } from "../../utils/cdp";
import { readAccount } from "../../utils/credentials";
import { ensureLoggedIn } from "../../utils/login";
import { LOCK_ROUTE, VAULT_ROUTE } from "../../utils/routes";
import { attachToDesktop } from "../utils/app";

const ACCOUNT_NAME = "default";

const BIOMETRIC_CHECKBOX = 'input[formcontrolname="biometric"]';
const UNLOCK_BUTTON_TEXT = /unlock with (touch id|windows hello|system authentication|biometrics)/i;
const CLOSE_DIALOG_TEXT = /^close$/i;

let app: AttachedApp;
let driver: AutomationDriver;

test.beforeAll(async () => {
  app = await attachToDesktop();
  driver = new AutomationDriver(app.page);
});

test.afterAll(async () => {
  await app?.detach();
});

test("enrolls biometric unlock, then locks and unlocks with it", async () => {
  const { page } = app;

  await ensureLoggedIn(page, readAccount(ACCOUNT_NAME));
  await driver.biometrics.setStatus(BiometricsStatus.Available);

  // Enroll: toggling the setting stores the biometric unlock key, no prompt.
  await driver.openSettings();
  const enrollment = page.locator(BIOMETRIC_CHECKBOX);
  await enrollment.check();
  await expect(enrollment).toBeChecked();

  await page.getByRole("button", { name: CLOSE_DIALOG_TEXT }).click();

  await driver.lockVault();
  await expect(page).toHaveURL(LOCK_ROUTE);

  // Unlock: the button blocks on the prompt, so approve while the click is pending.
  const unlock = page.getByRole("button", { name: UNLOCK_BUTTON_TEXT });
  await unlock.click();
  await approveNextRequest();

  await expect(page).toHaveURL(VAULT_ROUTE);
});

/** Waits for the client to queue a biometric prompt, then approves it. */
async function approveNextRequest(): Promise<void> {
  await expect.poll(async () => (await driver.biometrics.listPending()).length).toBeGreaterThan(0);

  await driver.biometrics.approve();
}
