import { expect, Page } from "@playwright/test";

const ACCOUNT_SECURITY_ROUTE = "#/account-security";
const VAULT_ROUTE = "#/tabs/vault";
const PIN_CHECKBOX = "input#pin";
const PIN_EPHEMERAL_CHECKBOX = "input#pinEphemeral";
// The set-PIN dialog (libs/angular/src/auth/components/set-pin.component.ts).
const PIN_INPUT = 'input[formcontrolname="pin"]';

/**
 * Turns on unlock with PIN from the popup's account security page, leaving "require master
 * password on browser restart" on. That makes the PIN ephemeral (after-first-unlock): it
 * lives in memory only, and is lost when the extension restarts.
 */
export async function enableEphemeralPin(popup: Page, pin: string) {
  await navigate(popup, ACCOUNT_SECURITY_ROUTE);
  // Not check(): the box stays unchecked until the set-PIN dialog it opens is submitted.
  await popup.locator(PIN_CHECKBOX).click();

  const dialog = popup.getByRole("dialog");
  await dialog.locator(PIN_INPUT).fill(pin);
  await dialog.getByRole("button", { name: "Set PIN" }).click();
  await expect(dialog).toBeHidden();

  await expect(popup.locator(PIN_EPHEMERAL_CHECKBOX)).toBeChecked();

  // Back to a page with the account switcher in its header.
  await navigate(popup, VAULT_ROUTE);
}

/** Hash routing: changing the hash navigates in place, without restarting the popup. */
async function navigate(popup: Page, route: string) {
  await popup.evaluate((hash) => (window.location.hash = hash), route);
}
