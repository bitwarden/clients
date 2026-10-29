import { BrowserContext, expect, Page } from "@playwright/test";

import { popupUrl } from "./fixtures";

const ACCOUNT_SECURITY_ROUTE = "#/account-security";
const VAULT_ROUTE = "#/tabs/vault";
const PIN_CHECKBOX = "Unlock with PIN";
const RESTART_CHECKBOX = "Require master password on browser restart";
const PIN_DIALOG_INPUT = 'input[type="password"]';

/**
 * Enables PIN unlock on the account security page, then returns to the vault. The PIN
 * survives restarts: an ephemeral one stops lock from restarting the extension.
 */
export async function enablePin(context: BrowserContext, popup: Page, pin: string) {
  const url = await popupUrl(context);
  await popup.goto(url + ACCOUNT_SECURITY_ROUTE);
  const checkbox = popup.getByRole("checkbox", { name: PIN_CHECKBOX });

  // Checking opens the set PIN dialog; the box stays unchecked until it is confirmed.
  await checkbox.click();
  const pinDialog = popup.getByRole("dialog");
  await pinDialog.locator(PIN_DIALOG_INPUT).fill(pin);
  await pinDialog.getByRole("checkbox", { name: RESTART_CHECKBOX }).uncheck();
  await pinDialog.getByRole("button", { name: "Set PIN", exact: true }).click();

  await expect(pinDialog).toBeHidden();
  await expect(checkbox).toBeChecked();
  await popup.goto(url + VAULT_ROUTE);
}
