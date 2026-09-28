import { expect, Page } from "@playwright/test";

/** Settings page that hosts the "Log in with passkey" section. */
const SETTINGS_URL = "/#/settings/security/password";

const MASTER_PASSWORD_INPUT = "user-verification-master-password-input";
const ENABLE_BUTTON = "passkey-enable-button";
const NEW_PASSKEY_BUTTON = "passkey-new-button";
const ROW = "passkey-row";
const NAME_CELL = "passkey-name";
const USED_FOR_ENCRYPTION_LABEL = "passkey-used-for-encryption";
const REMOVE_BUTTON = "passkey-remove-button";
const CREATE_NAME_INPUT = "create-passkey-name-input";
const CREATE_ENCRYPTION_CHECKBOX = "create-passkey-encryption-checkbox";
const CREATE_SUBMIT_BUTTON = "create-passkey-submit-button";
const DELETE_SUBMIT_BUTTON = "delete-passkey-submit-button";

/**
 * Drives the web vault's passkey login settings
 * (apps/web/src/app/auth/settings/webauthn-login-settings).
 */
export class PasskeySettingsPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(SETTINGS_URL);
    await expect(this.addButton()).toBeVisible();
  }

  /**
   * Registers a passkey with PRF turned on, so it can decrypt the vault on login.
   * Needs an authenticator that supports PRF, else the encryption checkbox never shows.
   */
  async addWithPrf(name: string, masterPassword: string) {
    // WebAuthn needs a focused page; other tabs, e.g. the extension's welcome tab, take focus.
    await this.page.bringToFront();
    await this.addButton().click();

    const dialog = this.page.getByRole("dialog");
    await dialog.getByTestId(MASTER_PASSWORD_INPUT).fill(masterPassword);
    await dialog.getByTestId(CREATE_SUBMIT_BUTTON).click();

    // The credential is created right after verification; naming comes next.
    const nameInput = dialog.getByTestId(CREATE_NAME_INPUT);
    await expect(nameInput).toBeVisible();
    await nameInput.fill(name);
    await dialog.getByTestId(CREATE_ENCRYPTION_CHECKBOX).check();
    await dialog.getByTestId(CREATE_SUBMIT_BUTTON).click();

    await expect(dialog).toBeHidden();
    await expect(this.rows(name).getByTestId(USED_FOR_ENCRYPTION_LABEL)).toBeVisible();
  }

  /** Removes every passkey called `name`, e.g. leftovers of an aborted run. */
  async removeAll(name: string, masterPassword: string) {
    const removeButton = this.rows(name).getByTestId(REMOVE_BUTTON);

    while ((await removeButton.count()) > 0) {
      const rows = await removeButton.count();
      await removeButton.first().click();

      const dialog = this.page.getByRole("dialog");
      await dialog.getByTestId(MASTER_PASSWORD_INPUT).fill(masterPassword);
      await dialog.getByTestId(DELETE_SUBMIT_BUTTON).click();

      await expect(dialog).toBeHidden();
      await expect(removeButton).toHaveCount(rows - 1);
    }
  }

  /** "Turn on" for the first passkey, "New passkey" once one exists. */
  private addButton() {
    return this.page.getByTestId(ENABLE_BUTTON).or(this.page.getByTestId(NEW_PASSKEY_BUTTON));
  }

  /** Rows whose name is exactly `name`; "e2e-prf" must not match "e2e-prf-2". */
  private rows(name: string) {
    const nameCell = this.page
      .getByTestId(NAME_CELL)
      .and(this.page.getByText(name, { exact: true }));
    return this.page.getByTestId(ROW).filter({ has: nameCell });
  }
}
