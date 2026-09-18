import { test as base, createBdd } from "playwright-bdd";

import { AutomationDriver } from "../../utils/automation-driver";
import { AttachedApp } from "../../utils/cdp";

import { attachToDesktop } from "./app";

////
// Playwright-BDD wiring for the desktop suite. The app is launched outside
// Playwright, so `page` is replaced by the attached renderer page instead of a
// browser Playwright opened itself. The attachment is worker-scoped: every
// scenario in a worker drives the same app instance, like the spec files do.
////

type DesktopWorkerFixtures = {
  app: AttachedApp;
};

type DesktopFixtures = {
  driver: AutomationDriver;
};

export const test = base.extend<DesktopFixtures, DesktopWorkerFixtures>({
  app: [
    // Destructured so Playwright sees the fixture takes no dependencies.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const app = await attachToDesktop();
      await use(app);
      await app.detach();
    },
    { scope: "worker" },
  ],

  page: async ({ app }, use) => {
    await use(app.page);
  },

  driver: async ({ page }, use) => {
    await use(new AutomationDriver(page));
  },
});

export const { Given, When, Then } = createBdd(test);
