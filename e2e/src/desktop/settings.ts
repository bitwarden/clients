import { ElectronApplication, expect, Page } from "@playwright/test";

import { clickMenuItem, MenuItem } from "./app-menu";
import { Biometrics } from "./biometrics";
import { mainLogged } from "./main-log";

// The set-PIN dialog (libs/angular/src/auth/components/set-pin.component.ts).
const PIN_INPUT = 'input[formcontrolname="pin"]';
const SETTINGS_DIALOG = "settings-dialog";
const BIOMETRIC_CHECKBOX = "settings-biometric-checkbox";
const PIN_CHECKBOX = "settings-pin-checkbox";
const SET_PIN_DIALOG = "set-pin-dialog";
const SET_PIN_INPUT = "set-pin-input";
const SET_PIN_ON_RESTART_CHECKBOX = "set-pin-require-master-password-checkbox";
const SET_PIN_SUBMIT_BUTTON = "set-pin-submit-button";
const DUCKDUCKGO_CHECKBOX = "settings-duckduckgo-checkbox";
// The tab holding settings shared by every account ("appPreferences").
const APP_SETTINGS_TAB = "App settings (all accounts)";
// NativeMessagingMain.listen, once the IPC server accepts clients.
const NATIVE_MESSAGING_STARTED = "Native messaging server started at";

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

  /**
   * Allows DuckDuckGo to connect over native messaging, and waits until the IPC server is up.
   * macOS only. It also writes DuckDuckGo's host manifest into the real home directory, if
   * DuckDuckGo is installed there.
   */
  async enableDuckDuckGo() {
    // Enabling restarts the IPC server, dropping any client that connected before.
    const started = mainLogged(this.app, NATIVE_MESSAGING_STARTED);

    await this.openAppSettingsTab();
    await this.dialog().getByTestId(DUCKDUCKGO_CHECKBOX).check();
    await started;
  }

  private async openAppSettingsTab() {
    await this.dialog().getByRole("tab", { name: APP_SETTINGS_TAB }).click();
  }

  private dialog() {
    return this.window.getByTestId(SETTINGS_DIALOG);
  }
}
