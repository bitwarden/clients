import { test as base, createBdd } from "playwright-bdd";

import { attachToPopup } from "../../browser/utils/app";
import { attachToDesktop } from "../../desktop/utils/app";
import { AutomationDriver } from "../../utils/automation-driver";
import { AttachedApp } from "../../utils/cdp";

////
// Playwright-BDD wiring for the cross-client suite. Both clients are launched by
// `start.js`, so the scenarios attach to two pages instead of opening a browser:
// `desktop` is the Electron renderer, `extension` is the popup. Biometric prompts
// are always mocked on the desktop side, which is where the hardware would be.
////

type CombinedWorkerFixtures = {
  desktopApp: AttachedApp;
  extensionApp: AttachedApp;
};

type CombinedFixtures = {
  desktop: AttachedApp["page"];
  extension: AttachedApp["page"];
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

  extensionApp: [
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const app = await attachToPopup();
      await use(app);
      await app.detach();
    },
    { scope: "worker" },
  ],

  desktop: async ({ desktopApp }, use) => {
    await use(desktopApp.page);
  },

  extension: async ({ extensionApp }, use) => {
    await use(extensionApp.page);
  },

  driver: async ({ desktop }, use) => {
    await use(new AutomationDriver(desktop));
  },

  extensionDriver: async ({ extension }, use) => {
    await use(new AutomationDriver(extension));
  },
});

export const { Given, When, Then } = createBdd(test);
