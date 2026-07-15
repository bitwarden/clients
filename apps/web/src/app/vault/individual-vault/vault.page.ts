import { $, browser } from "@wdio/globals";

interface OnboardingDialog {
  root: string;
  dismiss: string;
}

// The vault shows at most one of these after login; each is dismissed by its own button, which
// sits above the CDK backdrop and is therefore clickable.
const ONBOARDING_DIALOGS: OnboardingDialog[] = [
  { root: "app-unified-upgrade-dialog", dismiss: 'button[biticonbutton="bwi-close"]' },
  { root: "app-vault-welcome-dialog", dismiss: 'button[buttontype="secondary"]' },
  { root: "web-vault-extension-prompt-dialog", dismiss: 'button[bitbutton="secondary"]' },
];

/** Page object for the individual web vault. */
class VaultPage {
  get vaultItems() {
    return $("app-vault-items");
  }

  /**
   * After login the user passes through onboarding gates before reaching the vault: new users are
   * redirected to a setup-extension page, and the vault itself may open one onboarding dialog
   * (upgrade / welcome / extension prompt). Click through whichever appears, the way a user would.
   */
  async dismissOnboardingGates(): Promise<void> {
    await this.skipSetupExtension();
    await this.dismissOnboardingDialog();
  }

  async waitForReady(): Promise<void> {
    await this.vaultItems.waitForDisplayed();
  }

  private async skipSetupExtension(): Promise<void> {
    const setupExtension = $("vault-setup-extension");
    await browser.waitUntil(
      async () => (await setupExtension.isExisting()) || (await this.vaultItems.isExisting()),
      { timeout: 30000, timeoutMsg: "Neither the setup-extension gate nor the vault rendered" },
    );

    if (!(await setupExtension.isExisting())) {
      return;
    }

    // "Add It Later" always opens a confirmation dialog whose "skip to web app" action closes it
    // and navigates to the vault.
    await $("vault-setup-extension button[bitlink]").click();
    const skipConfirm = $("[bitdialogclose]");
    if (await skipConfirm.isDisplayed().catch(() => false)) {
      await skipConfirm.click();
    }
    await this.vaultItems.waitForDisplayed({ timeout: 30000 });
  }

  private async dismissOnboardingDialog(): Promise<void> {
    // The onboarding dialog opens asynchronously — the upgrade variant only after a full sync — so
    // give it a generous window. No dialog appearing is a valid outcome for an onboarded account.
    let dialog: OnboardingDialog | undefined;
    const appeared = await browser
      .waitUntil(
        async () => {
          for (const candidate of ONBOARDING_DIALOGS) {
            if (await $(candidate.root).isExisting()) {
              dialog = candidate;
              return true;
            }
          }
          return false;
        },
        { timeout: 35000, interval: 500 },
      )
      .then(() => true)
      .catch(() => false);

    if (!appeared || !dialog) {
      return;
    }

    await $(`${dialog.root} ${dialog.dismiss}`).click();
    await $(dialog.root).waitForExist({ reverse: true, timeout: 10000 });
  }
}

export const vaultPage = new VaultPage();
