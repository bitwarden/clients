import { expect, Page } from "@playwright/test";

import { AutomationDriver } from "../../utils/automation-driver";
import { PinEnvelope } from "../../utils/pin-envelope";

////
// PIN enrollment, driven through the desktop settings dialog.
////

const SETTINGS_DIALOG_TEXT = /^app settings/i;
const PIN_DIALOG_TEXT = /^unlock with pin$/i;
const PIN_SETTING_CHECKBOX = 'input[type="checkbox"][formcontrolname="pin"]';
const PIN_DIALOG_INPUT = 'input[type="password"][formcontrolname="pin"]';
const REQUIRE_MASTER_PASSWORD_CHECKBOX =
  'input[formcontrolname="requireMasterPasswordOnClientRestart"]';
const OK_TEXT = /^ok$/i;
const SETTING_WRITE_TIMEOUT = 10_000;
const DISABLE_RETRY_TIMEOUT = 60_000;
const CLOSE_DIALOG_TEXT = /^close$/i;

export async function enablePin(
  page: Page,
  driver: AutomationDriver,
  pin: string,
  envelope: PinEnvelope,
): Promise<void> {
  const settings = await openSettings(page, driver);
  const pinSetting = settings.locator(PIN_SETTING_CHECKBOX);
  await pinSetting.check();

  const pinDialog = page.getByRole("dialog", { name: PIN_DIALOG_TEXT });
  await pinDialog.locator(PIN_DIALOG_INPUT).fill(pin);

  // Checked by default, which is what makes the envelope ephemeral.
  const requireMasterPassword = pinDialog.locator(REQUIRE_MASTER_PASSWORD_CHECKBOX);
  if (envelope === PinEnvelope.Ephemeral) {
    await requireMasterPassword.check();
  } else {
    await requireMasterPassword.uncheck();
  }

  await pinDialog.getByRole("button", { name: OK_TEXT }).click();
  await expect(pinDialog).toBeHidden();
  await expect(pinSetting).toBeChecked();

  await closeSettings(settings);
}

export async function disablePin(page: Page, driver: AutomationDriver): Promise<void> {
  // The setting writes through to state asynchronously and reverts itself when
  // that fails, so the toggle is retried from a freshly opened dialog.
  await expect(async () => {
    const settings = await openSettings(page, driver);
    const pinSetting = settings.locator(PIN_SETTING_CHECKBOX);

    await pinSetting.uncheck();
    await expect(pinSetting).not.toBeChecked({ timeout: SETTING_WRITE_TIMEOUT });

    await closeSettings(settings);
  }).toPass({ timeout: DISABLE_RETRY_TIMEOUT });
}

async function openSettings(page: Page, driver: AutomationDriver) {
  await driver.openSettings();
  const settings = page.getByRole("dialog", { name: SETTINGS_DIALOG_TEXT });
  await expect(settings).toBeVisible();

  return settings;
}

async function closeSettings(settings: ReturnType<Page["getByRole"]>): Promise<void> {
  await settings.getByRole("button", { name: CLOSE_DIALOG_TEXT }).click();
  await expect(settings).toBeHidden();
}
