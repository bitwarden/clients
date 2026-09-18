import { expect, Locator, Page } from "@playwright/test";

import { AutomationDriver } from "../../utils/automation-driver";

////
// The desktop settings dialog, which is where unlock methods are enrolled.
////

const SETTINGS_DIALOG_TEXT = /^app settings/i;
const CLOSE_DIALOG_TEXT = /^close$/i;

export async function openSettings(page: Page, driver: AutomationDriver): Promise<Locator> {
  await driver.openSettings();
  const settings = page.getByRole("dialog", { name: SETTINGS_DIALOG_TEXT });
  await expect(settings).toBeVisible();

  return settings;
}

export async function closeSettings(settings: Locator): Promise<void> {
  await settings.getByRole("button", { name: CLOSE_DIALOG_TEXT }).click();
  await expect(settings).toBeHidden();
}
