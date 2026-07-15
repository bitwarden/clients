import { Locator, Page } from "@playwright/test";

import { SelfHostedEnvConfigDialogFragment } from "../self-hosted-env-config-dialog/self-hosted-env-config-dialog.fragment";

/** Page object for the login environment selector. */
export class EnvironmentSelectorPage {
  readonly root: Locator;
  // Menu trigger; region/self-hosted options are in the DOM only once the menu is opened.
  readonly trigger: Locator;
  // Self-hosted entry in the opened menu overlay.
  readonly selfHostedOption: Locator;
  private readonly selfHostedDialog: SelfHostedEnvConfigDialogFragment;

  constructor(private readonly page: Page) {
    this.root = page.locator("environment-selector");
    this.trigger = page.locator("environment-selector button[bitlink]");
    this.selfHostedOption = page
      .locator(".bit-menu-panel")
      .getByRole("menuitem", { name: "self-hosted" });
    this.selfHostedDialog = new SelfHostedEnvConfigDialogFragment(page);
  }

  /** Opens the selector, chooses "self-hosted", and enters the server URL in the resulting dialog. */
  async selectSelfHosted(serverUrl: string): Promise<void> {
    await this.trigger.click();
    await this.selfHostedOption.click();
    await this.selfHostedDialog.setBaseUrlAndSave(serverUrl);
  }
}
