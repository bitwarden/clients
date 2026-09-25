import { expect, Page } from "@playwright/test";

const MASTER_PASSWORD_INPUT = 'input[name="masterPassword"]';
const UNLOCK_TIMEOUT_MS = 60_000;

/**
 * Drives the lock screen every client shares (libs/key-management-ui/src/lock).
 */
export class LockScreen {
  constructor(private page: Page) {}

  /** The lock screen is ready once the master password field shows. */
  async waitUntilShown() {
    await expect(this.page.locator(MASTER_PASSWORD_INPUT)).toBeVisible({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }

  async unlockWithMasterPassword(password: string) {
    await this.page.locator(MASTER_PASSWORD_INPUT).fill(password);
    await this.page.getByRole("button", { name: "Unlock", exact: true }).click();
    await this.waitUntilGone();
  }

  /** Unlocking navigates away, which removes the master password field. */
  async waitUntilGone() {
    await expect(this.page.locator(MASTER_PASSWORD_INPUT)).toBeHidden({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }
}
