import { expect, Page } from "@playwright/test";

import { AutomationDriver } from "./automation-driver";

////
// PIN enrollment, driven through the desktop settings dialog.
////

/** Where the PIN-protected user key is kept, decided at enrollment time. */
export const PinEnvelope = Object.freeze({
  /** After first unlock: in memory only, so a restart requires the master password. */
  Ephemeral: "ephemeral",
  /** Before first unlock: on disk, so the PIN keeps working after a restart. */
  Persistent: "persistent",
} as const);
export type PinEnvelope = (typeof PinEnvelope)[keyof typeof PinEnvelope];

const SETTINGS_DIALOG_TEXT = /^app settings/i;
const PIN_DIALOG_TEXT = /^unlock with pin$/i;
const PIN_SETTING_CHECKBOX = 'input[type="checkbox"][formcontrolname="pin"]';
const PIN_DIALOG_INPUT = 'input[type="password"][formcontrolname="pin"]';
const REQUIRE_MASTER_PASSWORD_CHECKBOX =
  'input[formcontrolname="requireMasterPasswordOnClientRestart"]';
const OK_TEXT = /^ok$/i;
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
  const settings = await openSettings(page, driver);
  const pinSetting = settings.locator(PIN_SETTING_CHECKBOX);

  await pinSetting.uncheck();
  await expect(pinSetting).not.toBeChecked();

  await closeSettings(settings);
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
