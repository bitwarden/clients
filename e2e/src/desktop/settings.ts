import { ElectronApplication, expect, Page } from "@playwright/test";

import { clickMenuItem, MenuItem } from "./app-menu";
import { Biometrics } from "./biometrics";

// The set-PIN dialog (libs/angular/src/auth/components/set-pin.component.ts).
const PIN_INPUT = 'input[formcontrolname="pin"]';

/**
 * Turns on unlock with PIN from the settings dialog, leaving "lock with master password on
 * restart" on. That makes the PIN ephemeral (after-first-unlock): it lives in renderer
 * memory only, and is lost when the renderer reloads.
 */
export async function enableEphemeralPin(app: ElectronApplication, window: Page, pin: string) {
  await clickMenuItem(app, MenuItem.Settings);
  const settings = window.getByRole("dialog");
  // Not check(): the box stays unchecked until the set-PIN dialog it opens is submitted.
  await settings.getByRole("checkbox", { name: "Unlock with PIN" }).click();

  // The set-PIN dialog opens on top of the settings dialog.
  const setPin = window.getByRole("dialog").last();
  await setPin.locator(PIN_INPUT).fill(pin);
  await expect(
    setPin.getByRole("checkbox", { name: "Lock with master password on restart" }),
  ).toBeChecked();
  await setPin.getByRole("button", { name: "Ok", exact: true }).click();
  await expect(window.getByRole("dialog")).toHaveCount(1);

  await window.keyboard.press("Escape");
  await expect(settings).toBeHidden();
}

const BIOMETRIC_CHECKBOX = "settings-biometric-checkbox";
// Settings and the set-PIN dialog both name their control "pin": a checkbox, then the field.
const PIN_CHECKBOX = 'input[type="checkbox"][formcontrolname="pin"]';
const PIN_FIELD = 'input[type="password"][formcontrolname="pin"]';
const PIN_ON_RESTART_CHECKBOX = 'input[formcontrolname="requireMasterPasswordOnClientRestart"]';

/** Drives the desktop settings dialog (apps/desktop/src/app/accounts/settings-dialog.component). */
export class DesktopSettings {
  constructor(
    private app: ElectronApplication,
    private window: Page,
  ) {}

  async open() {
    await clickMenuItem(this.app, MenuItem.Settings);
    await expect(this.dialog()).toBeVisible();
  }

  async close() {
    await this.window.keyboard.press("Escape");
    await expect(this.dialog()).toBeHidden();
  }

  /** Enrolling stores the key with the fake right away; it raises no prompt to approve. */
  async enableBiometrics(biometrics: Biometrics) {
    await this.dialog().getByTestId(BIOMETRIC_CHECKBOX).check();
    await biometrics.waitUntilEnrolled();
  }

  /** Sets a PIN that survives an app restart, through the set-PIN dialog stacked on settings. */
  async setPin(pin: string) {
    await this.dialog().locator(PIN_CHECKBOX).check();

    const setPin = this.window.getByRole("dialog").filter({ has: this.window.locator(PIN_FIELD) });
    await setPin.locator(PIN_FIELD).fill(pin);
    await setPin.locator(PIN_ON_RESTART_CHECKBOX).uncheck();
    await setPin.getByRole("button", { name: "Ok", exact: true }).click();

    await expect(setPin).toBeHidden();
    await expect(this.dialog().locator(PIN_CHECKBOX)).toBeChecked();
  }

  // The settings dialog is the first one; the set-PIN dialog stacks on top of it.
  private dialog() {
    return this.window.getByRole("dialog").first();
  }
}
