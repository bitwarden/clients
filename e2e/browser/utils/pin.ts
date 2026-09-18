import { expect, Page } from "@playwright/test";

import { PinEnvelope } from "../../utils/pin-envelope";

import { popupUrl } from "./app";

////
// PIN enrollment, driven through the extension's account security settings.
////

const ACCOUNT_SECURITY_ROUTE = "account-security";

const PIN_SETTING_CHECKBOX = "#pin";
const PIN_DIALOG_TEXT = /^set pin$/i;
const PIN_DIALOG_INPUT = 'input[type="password"][formcontrolname="pin"]';
const REQUIRE_MASTER_PASSWORD_CHECKBOX =
  'input[formcontrolname="requireMasterPasswordOnClientRestart"]';
const SET_PIN_TEXT = /^set pin$/i;

export async function enablePin(page: Page, pin: string, envelope: PinEnvelope): Promise<void> {
  await openAccountSecurity(page);

  const pinSetting = page.locator(PIN_SETTING_CHECKBOX);
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

  await pinDialog.getByRole("button", { name: SET_PIN_TEXT }).click();
  await expect(pinDialog).toBeHidden();
  await expect(pinSetting).toBeChecked();
}

export async function disablePin(page: Page): Promise<void> {
  await openAccountSecurity(page);

  const pinSetting = page.locator(PIN_SETTING_CHECKBOX);
  await pinSetting.uncheck();
  await expect(pinSetting).not.toBeChecked();
}

async function openAccountSecurity(page: Page): Promise<void> {
  await page.goto(popupUrl(page.url(), ACCOUNT_SECURITY_ROUTE));
  await expect(page.locator(PIN_SETTING_CHECKBOX)).toBeVisible();
}
