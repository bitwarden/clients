import { ElectronApplication, expect, Page } from "@playwright/test";

import { clickMenuItem, MenuItem } from "./app-menu";
import { Biometrics } from "./biometrics";

const BIOMETRIC_CHECKBOX = "settings-biometric-checkbox";
// Settings and the set-PIN dialog both name their control "pin": a checkbox, then the field.
const PIN_CHECKBOX = 'input[type="checkbox"][formcontrolname="pin"]';
const PIN_INPUT = 'input[type="password"][formcontrolname="pin"]';
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

    const setPin = this.window.getByRole("dialog").filter({ has: this.window.locator(PIN_INPUT) });
    await setPin.locator(PIN_INPUT).fill(pin);
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
