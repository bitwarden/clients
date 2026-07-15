import { $, browser } from "@wdio/globals";

/** Page object for the popup first-run intro carousel. */
class IntroCarouselPage {
  get root() {
    return $("app-intro-carousel");
  }

  // The carousel's secondary action ("Log In") leaves onboarding for the login screen.
  get loginButton() {
    return this.root.$('button[buttontype="secondary"]');
  }

  /** First-run navigation to /login can be intercepted by the intro carousel; skip it if shown. */
  async skipIfPresent(): Promise<void> {
    if (!(await this.root.isExisting())) {
      return;
    }

    // The carousel's DOM appears before Angular (OnPush) binds its click handlers, so an early
    // click is silently dropped and the carousel never navigates away. Re-click until it does.
    await browser.waitUntil(
      async () => {
        if (!(await this.root.isExisting())) {
          return true;
        }
        await this.loginButton.click();
        return !(await this.root.isExisting());
      },
      {
        timeout: 20000,
        interval: 1000,
        timeoutMsg: "Intro carousel did not dismiss after clicking Log In",
      },
    );
  }
}

export const introCarouselPage = new IntroCarouselPage();
