import { ElectronApplication, expect, Page } from "@playwright/test";

import { clickMenuItem, MenuItem } from "./app-menu";
import { Biometrics } from "./biometrics";

const SETTINGS_DIALOG = "settings-dialog";
const BIOMETRIC_CHECKBOX = "settings-biometric-checkbox";
const PIN_CHECKBOX = "settings-pin-checkbox";
const SET_PIN_DIALOG = "set-pin-dialog";
const SET_PIN_INPUT = "set-pin-input";
const SET_PIN_ON_RESTART_CHECKBOX = "set-pin-require-master-password-checkbox";
const SET_PIN_SUBMIT_BUTTON = "set-pin-submit-button";

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
    await this.dialog().getByTestId(PIN_CHECKBOX).check();

    const setPin = this.window.getByTestId(SET_PIN_DIALOG);
    await setPin.getByTestId(SET_PIN_INPUT).fill(pin);
    await setPin.getByTestId(SET_PIN_ON_RESTART_CHECKBOX).uncheck();
    await setPin.getByTestId(SET_PIN_SUBMIT_BUTTON).click();

    await expect(setPin).toBeHidden();
    await expect(this.dialog().getByTestId(PIN_CHECKBOX)).toBeChecked();
  }

  private dialog() {
    return this.window.getByTestId(SETTINGS_DIALOG);
  }
}
