import { Locator, Page, expect } from "@playwright/test";

/** Fragment for the self-hosted environment configuration dialog, opened from the environment selector. */
export class SelfHostedEnvConfigDialogFragment {
  readonly baseUrlInput: Locator;
  readonly saveButton: Locator;

  constructor(private readonly page: Page) {
    this.baseUrlInput = page.locator("#self_hosted_env_settings_form_input_base_url");
    this.saveButton = page.locator('form[bit-dialog] button[type="submit"]');
  }

  async setBaseUrlAndSave(url: string): Promise<void> {
    await this.baseUrlInput.fill(url);
    await this.saveButton.click();
    // Dialog closes on save; wait for the input to leave the DOM.
    await expect(this.baseUrlInput).toBeHidden();
  }
}
