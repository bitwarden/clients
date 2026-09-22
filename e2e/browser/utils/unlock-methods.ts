import { expect, Page } from "@playwright/test";

import { popupUrl } from "./app";

////
// The extension's unlock methods, driven through its account security settings.
// The extension has no biometrics of its own: both settings below only record
// that unlocking goes through the desktop app over native messaging.
//
// Which of the two is shown depends on the shared unlock feature flag: it
// replaces the per-client biometric setting with one unlock state shared with
// the desktop app.
////

const ACCOUNT_SECURITY_ROUTE = "account-security";

export const UnlockSetting = Object.freeze({
  /** Deprecated; hidden once shared unlock is enabled. */
  BiometricUnlock: "#biometric",
  UnlockSharingWithDesktop: "#allowSharingUnlockStateWithDesktop",
} as const);
export type UnlockSetting = (typeof UnlockSetting)[keyof typeof UnlockSetting];

export async function enableUnlockSetting(page: Page, setting: UnlockSetting): Promise<void> {
  await setUnlockSetting(page, setting, true);
}

export async function disableUnlockSetting(page: Page, setting: UnlockSetting): Promise<void> {
  await setUnlockSetting(page, setting, false);
}

/** Reads the setting back without touching it, for asserting on it. */
export async function expectUnlockSetting(
  page: Page,
  setting: UnlockSetting,
  enabled: boolean,
): Promise<void> {
  await page.goto(popupUrl(page.url(), ACCOUNT_SECURITY_ROUTE));

  await expect(page.locator(setting)).toBeChecked({ checked: enabled });
}

async function setUnlockSetting(
  page: Page,
  setting: UnlockSetting,
  enabled: boolean,
): Promise<void> {
  await page.goto(popupUrl(page.url(), ACCOUNT_SECURITY_ROUTE));

  const checkbox = page.locator(setting);
  await expect(checkbox).toBeVisible();

  await checkbox.setChecked(enabled);
  await expect(checkbox).toBeChecked({ checked: enabled });
}
