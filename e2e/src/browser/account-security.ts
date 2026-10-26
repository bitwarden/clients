import { expect, Page } from "@playwright/test";

// AuthExtensionRoute.AccountSecurity (apps/browser/src/auth/popup/constants).
const ROUTE = "#/account-security";

const PIN_CHECKBOX = "account-security-pin-checkbox";
const DESKTOP_SYNC_CHECKBOX = "account-security-desktop-sync-checkbox";
const WEB_SYNC_CHECKBOX = "account-security-web-sync-checkbox";
const SET_PIN_DIALOG = "set-pin-dialog";
const SET_PIN_INPUT = "set-pin-input";
const SET_PIN_ON_RESTART_CHECKBOX = "set-pin-require-master-password-checkbox";
const SET_PIN_SUBMIT_BUTTON = "set-pin-submit-button";

/**
 * Drives Settings → Account security of the extension popup
 * (apps/browser/src/auth/popup/settings/account-security.component).
 */
export class AccountSecurityPage {
  constructor(private popup: Page) {}

  /** `popupUrl` is the popup's own URL, see `popupUrl` in ./fixtures. */
  async open(popupUrl: string) {
    await this.popup.goto(`${popupUrl}${ROUTE}`);
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
