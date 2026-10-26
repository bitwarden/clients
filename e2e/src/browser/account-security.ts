import { expect, Page } from "@playwright/test";

// AuthExtensionRoute.AccountSecurity (apps/browser/src/auth/popup/constants).
const ROUTE = "#/account-security";

const PIN_CHECKBOX = "#pin";
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
    await this.popup.goto(`${popupUrl}${ROUTE}`);
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
