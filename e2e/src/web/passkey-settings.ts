import { expect, Page } from "@playwright/test";

/** Settings page that hosts the "Log in with passkey" section. */
const SETTINGS_URL = "/#/settings/security/password";

const MASTER_PASSWORD_INPUT = "#masterPassword";
const ENABLE_BUTTON = "Turn on Log in with passkey";
const NEW_PASSKEY_BUTTON = "New passkey";
const USE_FOR_ENCRYPTION_CHECKBOX = "Use for vault encryption";
const USED_FOR_ENCRYPTION_LABEL = "Used for encryption";

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
    await this.addButton().click();

    const dialog = this.page.getByRole("dialog");
    await dialog.locator(MASTER_PASSWORD_INPUT).fill(masterPassword);
    await dialog.getByRole("button", { name: "Continue" }).click();

    // The credential is created right after verification; naming comes next.
    const nameInput = dialog.getByRole("textbox", { name: "Name" });
    await expect(nameInput).toBeVisible();
    await nameInput.fill(name);
    await dialog.getByRole("checkbox", { name: USE_FOR_ENCRYPTION_CHECKBOX }).check();
    await dialog.locator('button[type="submit"]').click();

    await expect(dialog).toBeHidden();
    await expect(this.row(name).getByText(USED_FOR_ENCRYPTION_LABEL)).toBeVisible();
  }

  /** Removes every passkey called `name`, e.g. leftovers of an aborted run. */
  async removeAll(name: string, masterPassword: string) {
    const removeButton = this.page.getByRole("button", { name: `Remove ${name}`, exact: true });

    while ((await removeButton.count()) > 0) {
      const rows = await removeButton.count();
      await removeButton.first().click();

      const dialog = this.page.getByRole("dialog");
      await dialog.locator(MASTER_PASSWORD_INPUT).fill(masterPassword);
      await dialog.getByRole("button", { name: "Remove" }).click();

      await expect(dialog).toBeHidden();
      await expect(removeButton).toHaveCount(rows - 1);
    }
  }

  /** "Turn on" for the first passkey, "New passkey" once one exists. */
  private addButton() {
    return this.page
      .getByRole("button", { name: ENABLE_BUTTON })
      .or(this.page.getByRole("button", { name: NEW_PASSKEY_BUTTON }));
  }

  private row(name: string) {
    return this.page.getByRole("row").filter({ hasText: name });
  }
}
