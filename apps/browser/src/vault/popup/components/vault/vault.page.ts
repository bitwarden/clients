import { $ } from "@wdio/globals";

/** Page object for the popup vault view (`app-vault`). */
class VaultPage {
  get root() {
    return $("app-vault");
  }

  async waitForDisplayed(): Promise<void> {
    await this.root.waitForDisplayed();
  }
}

export const vaultPage = new VaultPage();
