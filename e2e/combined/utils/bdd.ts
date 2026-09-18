import { Page } from "@playwright/test";
import { test as base, createBdd } from "playwright-bdd";

import { attachToPopup } from "../../browser/utils/app";
import { attachToDesktop } from "../../desktop/utils/app";
import { AutomationDriver } from "../../utils/automation-driver";
import { AttachedApp } from "../../utils/cdp";

////
// Playwright-BDD wiring for the cross-client suite. Both clients are launched by
// `start.js`, so the scenarios attach to running clients instead of opening a
// browser: `desktop` is the Electron renderer, and `extension` resolves the popup.
// Biometric prompts are always mocked on the desktop side, which is where the
// hardware would be.
//
// The popup is a page that comes and goes: locking the extension closes it, and
// the lock screen comes back in a new one. So `extension` is a function, not a
// page, and every step asks it for whatever popup is live now.
////

export type Popup = () => Promise<Page>;

type CombinedWorkerFixtures = {
  desktopApp: AttachedApp;
};

type CombinedFixtures = {
  desktop: Page;
  extension: Popup;
  /** The desktop automation driver; biometric prompts are mocked there. */
  driver: AutomationDriver;
  /** The extension's own driver, for extension-side state like feature flags. */
  extensionDriver: AutomationDriver;
};

export const test = base.extend<CombinedFixtures, CombinedWorkerFixtures>({
  desktopApp: [
    // Destructured so Playwright sees the fixture takes no dependencies.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const app = await attachToDesktop();
      await use(app);
      await app.detach();
    },
    { scope: "worker" },
  ],

  desktop: async ({ desktopApp }, use) => {
    await use(desktopApp.page);
  },

  // eslint-disable-next-line no-empty-pattern
  extension: async ({}, use) => {
    let app: AttachedApp | undefined;

    await use(async () => {
      if (app == null || app.page.isClosed()) {
        app = await attachToPopup();
      }

      return app.page;
    });

    // Left attached on purpose: closing the last popup page takes the browser with
    // it, and the next scenario needs it.
  },

  driver: async ({ desktop }, use) => {
    await use(new AutomationDriver(desktop));
  },

  extensionDriver: async ({ extension }, use) => {
    await use(new AutomationDriver(await extension()));
  },
});

export const { Given, When, Then } = createBdd(test);
