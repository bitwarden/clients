import { Locator, Page, expect } from "@playwright/test";

/** Page object for the popup vault view (`app-vault`). */
export class PopupVaultPage {
  readonly root: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator("app-vault");
  }

  async waitForDisplayed(): Promise<void> {
    await expect(this.root).toBeVisible({ timeout: 60_000 });
  }
}
