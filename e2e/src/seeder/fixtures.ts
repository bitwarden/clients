import { BrowserContext, Page, test as base } from "@playwright/test";

import { hasSeederAccount, seederAccount } from "../credentials";
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
 * Tags the context's same-origin fetches with the play id, so a server tracking play ids (see
 * e2e/README.md) records what the client creates, such as an account registered through the
 * UI, and `play.clean` deletes it.
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

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Why this run cannot seed, if it cannot. */
function seedingUnavailable(): string | undefined {
  // CI drives a deployed vault with no SeederApi in reach.
  if (!hasSeederAccount()) {
    return "No SeederApi account configured, see e2e/README.md.";
  }

  // A local SeederApi writes to the local database, where a deployed vault never looks.
  if (!IS_DEV_SERVER && LOOPBACK_HOSTS.has(new URL(seederAccount().url).hostname)) {
    return `A local SeederApi cannot seed ${WEB_VAULT_URL}; set E2E_SEEDER_URL to its own.`;
  }

  return undefined;
}

/** Web tests that seed data. */
export const test = base.extend<SeederFixtures>({
  play: async ({}, use, testInfo) => {
    const reason = seedingUnavailable();
    testInfo.skip(reason != null, reason);

    const play = new Play();
    await use(play);
    await play.clean();
  },

  context: async ({ play, context }, use) => {
    await tagRequests(context, play.id);
    await use(context);
  },

  newPage: async ({ play, browser }, use) => {
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
