import { expect, Page } from "@playwright/test";

const ACCOUNT_SECURITY_ROUTE = "#/account-security";
const VAULT_ROUTE = "#/tabs/vault";
const PIN_CHECKBOX = "input#pin";
const PIN_EPHEMERAL_CHECKBOX = "input#pinEphemeral";
// The set-PIN dialog (libs/angular/src/auth/components/set-pin.component.ts).
const PIN_INPUT = 'input[formcontrolname="pin"]';
const DESKTOP_SYNC_CHECKBOX = "#allowSharingUnlockStateWithDesktop";
const WEB_SYNC_CHECKBOX = "#allowSharingUnlockStateWithWeb";
const PIN_ON_RESTART_CHECKBOX = 'input[formcontrolname="requireMasterPasswordOnClientRestart"]';

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

const DESKTOP_SYNC_CHECKBOX = "#allowSharingUnlockStateWithDesktop";
const WEB_SYNC_CHECKBOX = "#allowSharingUnlockStateWithWeb";
const PIN_INPUT = 'input[formcontrolname="pin"]';
const PIN_ON_RESTART_CHECKBOX = 'input[formcontrolname="requireMasterPasswordOnClientRestart"]';

/**
 * Drives Settings → Account security of the extension popup
 * (apps/browser/src/auth/popup/settings/account-security.component).
 */
export class AccountSecurityPage {
  constructor(private popup: Page) {}

  /** `popupUrl` is the popup's own URL, see `popupUrl` in ./fixtures. */
  async open(popupUrl: string) {
    await this.popup.goto(`${popupUrl}${ACCOUNT_SECURITY_ROUTE}`);
    await expect(this.popup.locator(PIN_CHECKBOX)).toBeVisible();
  }

  /**
   * Sets a PIN that survives a browser restart, so the extension's own reload on lock keeps it.
   * Opens the set-PIN dialog (apps/browser/src/auth/popup/components/set-pin.component).
   */
  async setPin(pin: string) {
    await this.popup.locator(PIN_CHECKBOX).check();

    const dialog = this.popup.getByRole("dialog");
    await dialog.locator(PIN_INPUT).fill(pin);
    await dialog.locator(PIN_ON_RESTART_CHECKBOX).uncheck();
    await dialog.getByRole("button", { name: "Set PIN", exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(this.popup.locator(PIN_CHECKBOX)).toBeChecked();
  }

  /**
   * Needs the nativeMessaging permission already granted; otherwise the popup pops out to
   * request it, which Playwright cannot answer.
   */
  async enableDesktopSync() {
    await this.popup.locator(DESKTOP_SYNC_CHECKBOX).check();
    await expect(this.popup.locator(DESKTOP_SYNC_CHECKBOX)).toBeChecked();
  }

  /** Web sync is on by default (DefaultSharedUnlockSettingsService). */
  async expectWebSync() {
    await expect(this.popup.locator(WEB_SYNC_CHECKBOX)).toBeChecked();
  }
}
