import { Locator, Page, expect } from "@playwright/test";

/** Page object for the popup first-run intro carousel. */
export class IntroCarouselPage {
  readonly root: Locator;
  // Secondary "Log In" action that leaves onboarding.
  readonly loginButton: Locator;

  constructor(private readonly page: Page) {
    this.root = page.locator("app-intro-carousel");
    this.loginButton = this.root.locator('button[buttontype="secondary"]');
  }

  /** Skips the intro carousel if it is shown. */
  async skipIfPresent(): Promise<void> {
    if ((await this.root.count()) === 0) {
      return;
    }

    // Re-click until it navigates away: OnPush binds the handler after the DOM appears.
    await expect
      .poll(
        async () => {
          if ((await this.root.count()) === 0) {
            return true;
          }
          await this.loginButton.click().catch((): void => undefined);
          return (await this.root.count()) === 0;
        },
        { timeout: 20_000, intervals: [1000] },
      )
      .toBeTruthy();
  }
}
