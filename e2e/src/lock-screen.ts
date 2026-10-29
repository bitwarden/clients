import { expect, Page } from "@playwright/test";

// Host of the shared lock screen (libs/key-management-ui), whatever the unlock method.
const LOCK_SCREEN = "bit-lock";
const MASTER_PASSWORD_INPUT = 'input[name="masterPassword"]';
const PIN_INPUT = 'input[name="pin"]';
const UNLOCK_TIMEOUT_MS = 60_000;
// How long a build that tries the PIN once fully typed takes to start unlocking.
const PIN_AUTO_TRY_MS = 500;

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

    // Builds that try the PIN once fully typed are unlocking already; a click would wait for
    // the busy button until the lock screen is gone.
    if (!(await this.unlockStarted())) {
      await this.page.getByRole("button", { name: "Unlock", exact: true }).click();
    }

    await this.waitUntilGone();
  }

  /** The lock screen's submit button turns busy while unlocking, or the lock screen is gone. */
  private async unlockStarted(): Promise<boolean> {
    return this.page
      .waitForFunction(
        (lockScreen) => {
          const submit = document.querySelector(`${lockScreen} button[type="submit"]`);
          return submit == null || submit.getAttribute("aria-disabled") === "true";
        },
        LOCK_SCREEN,
        { timeout: PIN_AUTO_TRY_MS },
      )
      .then(() => true)
      .catch(() => false);
  }

  /** Unlocking navigates away, which removes the lock screen. */
  async waitUntilGone() {
    await expect(this.page.locator(LOCK_SCREEN)).not.toBeAttached({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }
}
