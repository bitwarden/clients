import { expect, Locator, Page } from "@playwright/test";

// Host of the shared lock screen (libs/key-management-ui), whatever the unlock method.
const LOCK_SCREEN = "bit-lock";
const MASTER_PASSWORD_INPUT = "lock-master-password-input";
const MASTER_PASSWORD_UNLOCK_BUTTON = "lock-master-password-unlock-button";
const PIN_INPUT = "lock-pin-input";
const PIN_UNLOCK_BUTTON = "lock-pin-unlock-button";
const UNLOCK_TIMEOUT_MS = 60_000;

export class LockScreen {
  constructor(private page: Page) {}

  /** Not keyed on the master password field: users without one unlock another way. */
  async waitUntilShown() {
    await expect(this.page.locator(LOCK_SCREEN)).toBeAttached({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }

  async unlockWithMasterPassword(password: string) {
    await this.page.getByTestId(MASTER_PASSWORD_INPUT).fill(password);
    await this.page.getByTestId(MASTER_PASSWORD_UNLOCK_BUTTON).click();
    await this.waitUntilGone();
  }

  /** Shown by default whenever the user can unlock with a PIN and has no biometrics. */
  get pinInput(): Locator {
    return this.page.getByTestId(PIN_INPUT);
  }

  async unlockWithPin(pin: string) {
    await this.pinInput.fill(pin);
    await this.page.getByTestId(PIN_UNLOCK_BUTTON).click();
    await this.waitUntilGone();
  }

  /** Unlocking navigates away, which removes the lock screen. */
  async waitUntilGone() {
    await expect(this.page.locator(LOCK_SCREEN)).not.toBeAttached({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }
}
