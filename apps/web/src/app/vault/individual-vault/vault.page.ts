import { Locator, Page, expect } from "@playwright/test";

interface OnboardingDialog {
  root: string;
  dismiss: string;
}

// At most one appears after login; each is dismissed by its own button.
const ONBOARDING_DIALOGS: OnboardingDialog[] = [
  { root: "app-unified-upgrade-dialog", dismiss: 'button[biticonbutton="bwi-close"]' },
  { root: "app-vault-welcome-dialog", dismiss: 'button[buttontype="secondary"]' },
  { root: "web-vault-extension-prompt-dialog", dismiss: 'button[bitbutton="secondary"]' },
];

/** Page object for the individual web vault. */
export class VaultPage {
  static readonly route = "/#/vault";

  readonly vaultItems: Locator;

  constructor(private readonly page: Page) {
    this.vaultItems = page.locator("app-vault-items");
  }

  async goto(): Promise<void> {
    await this.page.goto(VaultPage.route);
  }

  /** Clicks through the post-login onboarding gates to reach the vault. */
  async dismissOnboardingGates(): Promise<void> {
    await this.skipSetupExtension();
    await this.dismissOnboardingDialog();
  }

  async waitForReady(): Promise<void> {
    await expect(this.vaultItems).toBeVisible({ timeout: 30_000 });
  }

  private async skipSetupExtension(): Promise<void> {
    const setupExtension = this.page.locator("vault-setup-extension");
    await expect
      .poll(async () => (await setupExtension.count()) > 0 || (await this.vaultItems.count()) > 0, {
        timeout: 30_000,
      })
      .toBeTruthy();

    if ((await setupExtension.count()) === 0) {
      return;
    }

    // "Add It Later" opens a confirmation dialog whose skip action navigates to the vault.
    await this.page.locator("vault-setup-extension button[bitlink]").click();
    const skipConfirm = this.page.locator("[bitdialogclose]");
    const dialogAppeared = await skipConfirm
      .waitFor({ state: "visible", timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (dialogAppeared) {
      await skipConfirm.click();
    }
    await expect(this.vaultItems).toBeVisible({ timeout: 30_000 });
  }

  private async dismissOnboardingDialog(): Promise<void> {
    // Opens asynchronously; no dialog appearing is a valid outcome.
    let dialog: OnboardingDialog | undefined;
    const appeared = await expect
      .poll(
        async () => {
          for (const candidate of ONBOARDING_DIALOGS) {
            if ((await this.page.locator(candidate.root).count()) > 0) {
              dialog = candidate;
              return true;
            }
          }
          return false;
        },
        { timeout: 35_000, intervals: [500] },
      )
      .toBeTruthy()
      .then(() => true)
      .catch(() => false);

    if (!appeared || !dialog) {
      return;
    }

    await this.page.locator(`${dialog.root} ${dialog.dismiss}`).click();
    await expect(this.page.locator(dialog.root)).toBeHidden({ timeout: 10_000 });
  }
}
