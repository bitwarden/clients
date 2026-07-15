import { $ } from "@wdio/globals";

/** Fragment for the self-hosted environment configuration dialog, opened from the environment selector. */
class SelfHostedEnvConfigDialogFragment {
  get baseUrlInput() {
    return $("#self_hosted_env_settings_form_input_base_url");
  }

  get saveButton() {
    return $('form[bit-dialog] button[type="submit"]');
  }

  async setBaseUrlAndSave(url: string): Promise<void> {
    await this.baseUrlInput.setValue(url);
    await this.saveButton.click();
    await this.baseUrlInput.waitForExist({ reverse: true });
  }
}

export const selfHostedEnvConfigDialog = new SelfHostedEnvConfigDialogFragment();
