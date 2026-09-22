import { expect, Page } from "@playwright/test";

import { AutomationDriver } from "../../utils/automation-driver";

import { closeSettings, openSettings } from "./settings";

////
// Biometric unlock enrollment, driven through the desktop settings dialog.
// Toggling the setting stores or drops the biometric unlock key; no prompt.
////

const BIOMETRIC_SETTING_CHECKBOX = 'input[formcontrolname="biometric"]';

export async function enableBiometrics(page: Page, driver: AutomationDriver): Promise<void> {
  await setBiometrics(page, driver, true);
}

export async function disableBiometrics(page: Page, driver: AutomationDriver): Promise<void> {
  await setBiometrics(page, driver, false);
}

/** Reads the setting back without touching it, for asserting on it. */
export async function expectBiometrics(
  page: Page,
  driver: AutomationDriver,
  enabled: boolean,
): Promise<void> {
  const settings = await openSettings(page, driver);

  await expect(settings.locator(BIOMETRIC_SETTING_CHECKBOX)).toBeChecked({ checked: enabled });

  await closeSettings(settings);
}

async function setBiometrics(
  page: Page,
  driver: AutomationDriver,
  enabled: boolean,
): Promise<void> {
  const settings = await openSettings(page, driver);
  const setting = settings.locator(BIOMETRIC_SETTING_CHECKBOX);

  await setting.setChecked(enabled);
  await expect(setting).toBeChecked({ checked: enabled });

  await closeSettings(settings);
}
