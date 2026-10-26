import { expect, Page } from "@playwright/test";

// Host of the shared lock screen (libs/key-management-ui), whatever the unlock method.
const LOCK_SCREEN = "lock-screen";
const MASTER_PASSWORD_INPUT = "lock-master-password-input";
const MASTER_PASSWORD_UNLOCK_BUTTON = "lock-master-password-unlock-button";
const PIN_INPUT = "lock-pin-input";
const PIN_UNLOCK_BUTTON = "lock-pin-unlock-button";
const BIOMETRIC_UNLOCK_BUTTON = "lock-biometric-unlock-button";
const BIOMETRIC_SWAP_BUTTON = "lock-biometric-swap-button";
const UNLOCK_TIMEOUT_MS = 60_000;

export class LockScreen {
  constructor(private page: Page) {}

  /** Not keyed on the master password field: users without one unlock another way. */
  async waitUntilShown() {
    await expect(this.page.getByTestId(LOCK_SCREEN)).toBeAttached({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }

  async unlockWithMasterPassword(password: string) {
    await this.page.getByTestId(MASTER_PASSWORD_INPUT).fill(password);
    await this.page.getByTestId(MASTER_PASSWORD_UNLOCK_BUTTON).click();
    await this.waitUntilGone();
  }

  /** PIN is the default option when biometrics are unavailable and a PIN is set. */
  async unlockWithPin(pin: string) {
    await this.page.getByTestId(PIN_INPUT).fill(pin);
    await this.page.getByTestId(PIN_UNLOCK_BUTTON).click();
    await this.waitUntilGone();
  }

  /** Main button of the biometric option, the default one when biometrics are available. */
  biometricUnlockButton() {
    return this.page.getByTestId(BIOMETRIC_UNLOCK_BUTTON);
  }

  /** "Unlock with biometrics" on the master password and PIN options, which swaps to biometrics. */
  biometricSwapButton() {
    return this.page.getByTestId(BIOMETRIC_SWAP_BUTTON);
  }

  /** Unlocking navigates away, which removes the lock screen. */
  async waitUntilGone() {
    await expect(this.page.getByTestId(LOCK_SCREEN)).not.toBeAttached({
      timeout: UNLOCK_TIMEOUT_MS,
    });
  }
}
