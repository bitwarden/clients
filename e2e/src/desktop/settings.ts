import { ElectronApplication, expect, Page } from "@playwright/test";

import { clickMenuItem, MenuItem } from "./app-menu";
import { Biometrics } from "./biometrics";

// The set-PIN dialog (libs/angular/src/auth/components/set-pin.component.ts).
const PIN_INPUT = 'input[formcontrolname="pin"]';
const SETTINGS_DIALOG = "settings-dialog";
const BIOMETRIC_CHECKBOX = "settings-biometric-checkbox";
const PIN_CHECKBOX = "settings-pin-checkbox";
const SET_PIN_DIALOG = "set-pin-dialog";
const SET_PIN_INPUT = "set-pin-input";
const SET_PIN_ON_RESTART_CHECKBOX = "set-pin-require-master-password-checkbox";
const SET_PIN_SUBMIT_BUTTON = "set-pin-submit-button";
const SSH_AGENT_CHECKBOX = "settings-ssh-agent-checkbox";
// The tab holding settings shared by every account ("appPreferences").
const APP_SETTINGS_TAB = "App settings (all accounts)";

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

  /** Starts the SSH agent, which then serves the vault's SSH keys on its socket. */
  async enableSshAgent() {
    await this.dialog().getByRole("tab", { name: APP_SETTINGS_TAB }).click();
    await this.dialog().getByTestId(SSH_AGENT_CHECKBOX).check();
  }

  private dialog() {
    return this.window.getByTestId(SETTINGS_DIALOG);
  }
}
