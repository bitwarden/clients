import { expect, Page } from "@playwright/test";

// Host of the shared lock screen (libs/key-management-ui), whatever the unlock method.
const LOCK_SCREEN = "bit-lock";
const MASTER_PASSWORD_INPUT = 'input[name="masterPassword"]';
const PIN_INPUT = 'input[name="pin"]';
const UNLOCK_TIMEOUT_MS = 60_000;

/** PIN the suites set up for PIN unlock. */
export const TEST_PIN = "1234";

export class LockScreen {
  constructor(private page: Page) {}

  /** Not keyed on the master password field: users without one unlock another way. */
  async waitUntilShown() {
    await expect(this.page.locator(LOCK_SCREEN)).toBeAttached({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }

  async unlockWithMasterPassword(password: string) {
    await this.page.locator(MASTER_PASSWORD_INPUT).fill(password);
    await this.page.getByRole("button", { name: "Unlock", exact: true }).click();
    await this.waitUntilGone();
  }

  async unlockWithPin(pin: string) {
    await this.page.locator(PIN_INPUT).fill(pin);
    await this.page.getByRole("button", { name: "Unlock", exact: true }).click();
    await this.waitUntilGone();
  }

  /** Unlocking navigates away, which removes the lock screen. */
  async waitUntilGone() {
    await expect(this.page.locator(LOCK_SCREEN)).not.toBeAttached({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }
}
