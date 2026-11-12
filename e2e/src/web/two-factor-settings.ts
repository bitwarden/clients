import { expect, Page } from "@playwright/test";

/** Settings page listing the two-step login providers. */
const SETTINGS_URL = "/#/settings/security/two-factor";

/** `TwoFactorProviderType.WebAuthn` (libs/common/src/auth/enums/two-factor-provider-type.ts). */
const WEBAUTHN_PROVIDER_TYPE = 7;

const PROVIDER = "two-factor-provider";
const PROVIDER_ENABLED = "two-factor-provider-enabled";
const PROVIDER_MANAGE_BUTTON = "two-factor-provider-manage-button";
const MASTER_PASSWORD_INPUT = "user-verification-master-password-input";
const VERIFY_SUBMIT_BUTTON = "two-factor-verify-submit-button";
const WEBAUTHN_NAME_INPUT = "two-factor-webauthn-name-input";
const WEBAUTHN_READ_KEY_BUTTON = "two-factor-webauthn-read-key-button";
const WEBAUTHN_SAVE_BUTTON = "two-factor-webauthn-save-button";

/**
 * Drives the web vault's two-step login settings
 * (apps/web/src/app/auth/settings/two-factor).
 */
export class TwoFactorSettingsPage {
  constructor(private page: Page) {}

  async open() {
    await this.page.goto(SETTINGS_URL);
    await expect(
      this.provider(WEBAUTHN_PROVIDER_TYPE).getByTestId(PROVIDER_MANAGE_BUTTON),
    ).toBeEnabled();
  }

  /**
   * Turns on WebAuthn two-step login with a key called `name`. Needs an authenticator attached to
   * the page to answer the registration.
   */
  async addWebAuthnKey(name: string, masterPassword: string) {
    // WebAuthn needs a focused page.
    await this.page.bringToFront();
    const provider = this.provider(WEBAUTHN_PROVIDER_TYPE);
    await provider.getByTestId(PROVIDER_MANAGE_BUTTON).click();

    const verify = this.page.getByRole("dialog");
    await verify.getByTestId(MASTER_PASSWORD_INPUT).fill(masterPassword);
    await verify.getByTestId(VERIFY_SUBMIT_BUTTON).click();

    const setup = this.page.getByRole("dialog");
    await setup.getByTestId(WEBAUTHN_NAME_INPUT).fill(name);
    await setup.getByTestId(WEBAUTHN_READ_KEY_BUTTON).click();
    await setup.getByTestId(WEBAUTHN_SAVE_BUTTON).click();

    // Saving closes the dialog, and the provider shows as enabled.
    await expect(setup).toBeHidden();
    await expect(provider.getByTestId(PROVIDER_ENABLED)).toBeVisible();
  }

  private provider(type: number) {
    return this.page.locator(`[data-testid="${PROVIDER}"][data-provider-type="${type}"]`);
  }
}
