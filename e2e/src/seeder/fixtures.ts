import { BrowserContext, Page, test as base } from "@playwright/test";

import { hasSeederAccount } from "../credentials";
import { IS_DEV_SERVER, WEB_VAULT_URL } from "../server";

import { Play } from "./play";
import { PLAY_ID_HEADER } from "./seeder-api";

type SeederFixtures = {
  /** This test's server-side data, deleted once the test ends. */
  play: Play;
  /** Opens a page in a fresh context, e.g. to sign in a second user beside `page`. */
  newPage: () => Promise<Page>;
};

/**
 * Tags the context's same-origin fetches with the play id, so the server tracks what the
 * client creates, such as an account registered through the UI, and `play.clean` deletes it.
 * Cross-origin calls stay untagged, since a custom header would turn them into preflights.
 */
async function tagRequests(context: BrowserContext, playId: string) {
  await context.addInitScript(
    ({ header, id }) => {
      const originalFetch = window.fetch;

      window.fetch = (input, init) => {
        const request = new Request(input, init);

        if (new URL(request.url).origin === window.location.origin) {
          request.headers.set(header, id);
        }

        return originalFetch(request);
      };
    },
    { header: PLAY_ID_HEADER, id: playId },
  );
}

/** Web tests that seed data. */
export const test = base.extend<SeederFixtures>({
  play: async ({}, use, testInfo) => {
    // CI drives a deployed vault with no SeederApi in reach.
    testInfo.skip(!hasSeederAccount(), "No SeederApi account configured, see e2e/README.md.");

    const play = new Play();
    await use(play);
    await play.clean();
  },

  context: async ({ context, play }, use) => {
    await tagRequests(context, play.id);
    await use(context);
  },

  newPage: async ({ browser, play }, use) => {
    const contexts: BrowserContext[] = [];

    await use(async () => {
      // A context the test opens itself skips the config's `use` options.
      const context = await browser.newContext({
        baseURL: WEB_VAULT_URL,
        ignoreHTTPSErrors: IS_DEV_SERVER,
      });
      contexts.push(context);
      await tagRequests(context, play.id);

      return context.newPage();
    });

    await Promise.all(contexts.map((context) => context.close()));
  },
});
