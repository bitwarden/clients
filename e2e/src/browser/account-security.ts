import { expect, Page } from "@playwright/test";

// AuthExtensionRoute.AccountSecurity (apps/browser/src/auth/popup/constants).
const ACCOUNT_SECURITY_ROUTE = "#/account-security";
const VAULT_ROUTE = "#/tabs/vault";
const PIN_EPHEMERAL_CHECKBOX = "input#pinEphemeral";

const PIN_CHECKBOX = "account-security-pin-checkbox";
const DESKTOP_SYNC_CHECKBOX = "account-security-desktop-sync-checkbox";
const WEB_SYNC_CHECKBOX = "account-security-web-sync-checkbox";
const SET_PIN_DIALOG = "set-pin-dialog";
const SET_PIN_INPUT = "set-pin-input";
const SET_PIN_ON_RESTART_CHECKBOX = "set-pin-require-master-password-checkbox";
const SET_PIN_SUBMIT_BUTTON = "set-pin-submit-button";

/**
 * Turns on unlock with PIN from the popup's account security page, leaving "require master
 * password on browser restart" on. That makes the PIN ephemeral (after-first-unlock): it
 * lives in memory only, and is lost when the extension restarts.
 */
export async function enableEphemeralPin(popup: Page, pin: string) {
  await navigate(popup, ACCOUNT_SECURITY_ROUTE);
  // Not check(): the box stays unchecked until the set-PIN dialog it opens is submitted.
  await popup.getByTestId(PIN_CHECKBOX).click();

  const dialog = popup.getByTestId(SET_PIN_DIALOG);
  await dialog.getByTestId(SET_PIN_INPUT).fill(pin);
  await dialog.getByTestId(SET_PIN_SUBMIT_BUTTON).click();
  await expect(dialog).toBeHidden();

  await expect(popup.locator(PIN_EPHEMERAL_CHECKBOX)).toBeChecked();

  // Back to a page with the account switcher in its header.
  await navigate(popup, VAULT_ROUTE);
}

/** Hash routing: changing the hash navigates in place, without restarting the popup. */
async function navigate(popup: Page, route: string) {
  await popup.evaluate((hash) => (window.location.hash = hash), route);
}

/**
 * Drives Settings → Account security of the extension popup
 * (apps/browser/src/auth/popup/settings/account-security.component).
 */
export class AccountSecurityPage {
  constructor(private popup: Page) {}

  /** `popupUrl` is the popup's own URL, see `popupUrl` in ./fixtures. */
  async open(popupUrl: string) {
    await this.popup.goto(`${popupUrl}${ACCOUNT_SECURITY_ROUTE}`);
    await expect(this.popup.getByTestId(PIN_CHECKBOX)).toBeVisible();
  }

  /**
   * Sets a PIN that survives a browser restart, so the extension's own reload on lock keeps it.
   * Opens the set-PIN dialog (apps/browser/src/auth/popup/components/set-pin.component).
   */
  async setPin(pin: string) {
    await this.popup.getByTestId(PIN_CHECKBOX).check();

    const dialog = this.popup.getByTestId(SET_PIN_DIALOG);
    await dialog.getByTestId(SET_PIN_INPUT).fill(pin);
    await dialog.getByTestId(SET_PIN_ON_RESTART_CHECKBOX).uncheck();
    await dialog.getByTestId(SET_PIN_SUBMIT_BUTTON).click();

    await expect(dialog).toBeHidden();
    await expect(this.popup.getByTestId(PIN_CHECKBOX)).toBeChecked();
  }

  /**
   * Needs the nativeMessaging permission already granted; otherwise the popup pops out to
   * request it, which Playwright cannot answer.
   */
  async enableDesktopSync() {
    await this.popup.getByTestId(DESKTOP_SYNC_CHECKBOX).check();
    await expect(this.popup.getByTestId(DESKTOP_SYNC_CHECKBOX)).toBeChecked();
  }

  /** Web sync is on by default (DefaultSharedUnlockSettingsService). */
  async expectWebSync() {
    await expect(this.popup.getByTestId(WEB_SYNC_CHECKBOX)).toBeChecked();
  }
}
