import { $ } from "@wdio/globals";

import { selfHostedEnvConfigDialog } from "../self-hosted-env-config-dialog/self-hosted-env-config-dialog.fragment";

/** Page object for the login environment selector. */
class EnvironmentSelectorPage {
  get root() {
    return $("environment-selector");
  }

  // The only rendered button in the selector is the menu trigger; the region/self-hosted options
  // live in a `bit-menu` template and are not in the DOM until the menu is opened.
  get trigger() {
    return $("environment-selector button[bitlink]");
  }

  // The menu opens into a CDK overlay; the self-hosted entry is the menu item labelled "self-hosted".
  get selfHostedOption() {
    return $(".bit-menu-panel").$("button=self-hosted");
  }

  /** Opens the selector, chooses "self-hosted", and enters the server URL in the resulting dialog. */
  async selectSelfHosted(serverUrl: string): Promise<void> {
    await this.trigger.click();
    await this.selfHostedOption.click();
    await selfHostedEnvConfigDialog.setBaseUrlAndSave(serverUrl);
  }
}

export const environmentSelectorPage = new EnvironmentSelectorPage();
