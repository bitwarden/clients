import { expect, Page } from "@playwright/test";

// Host of the shared lock screen (libs/key-management-ui), whatever the unlock method.
const LOCK_SCREEN = "bit-lock";
const MASTER_PASSWORD_INPUT = 'input[name="masterPassword"]';
const PIN_INPUT = 'input[name="pin"]';
const BIOMETRIC_UNLOCK_BUTTON = "lock-biometric-unlock-button";
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
    await this.page.locator(MASTER_PASSWORD_INPUT).fill(password);
    await this.page.getByRole("button", { name: "Unlock", exact: true }).click();
    await this.waitUntilGone();
  }

  /** PIN is the default option when biometrics are unavailable and a PIN is set. */
  async unlockWithPin(pin: string) {
    await this.page.locator(PIN_INPUT).fill(pin);
    await this.page.getByRole("button", { name: "Unlock", exact: true }).click();
    await this.waitUntilGone();
  }

  /** Main button of the biometric option, the default one when biometrics are available. */
  biometricUnlockButton() {
    return this.page.getByTestId(BIOMETRIC_UNLOCK_BUTTON);
  }

  /** "Unlock with biometrics" on the master password and PIN options, which swaps to biometrics. */
  biometricSwapButton() {
    return this.page.getByRole("button", { name: "Unlock with biometrics", exact: true });
  }

  /** Unlocking navigates away, which removes the lock screen. */
  async waitUntilGone() {
    await expect(this.page.locator(LOCK_SCREEN)).not.toBeAttached({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }
}
