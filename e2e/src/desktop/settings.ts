import { ElectronApplication, expect, Page } from "@playwright/test";

import { clickMenuItem, MenuItem } from "./app-menu";

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
