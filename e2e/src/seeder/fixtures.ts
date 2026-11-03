import { BrowserContext, Page, test as base } from "@playwright/test";

import { pruneVideo, videoDir } from "../artifacts";
import { hasSeederAccount, seederAccount } from "../credentials";
import { IS_DEV_SERVER, WEB_VAULT_URL } from "../server";

import { Play } from "./play";
import { PLAY_ID_HEADER, SeederApi } from "./seeder-api";

type SeederFixtures = {
  /** This test's server-side data, deleted once the test ends. */
  play: Play;
  /** Opens a page in a fresh context, e.g. to sign in a second user beside `page`. */
  newPage: () => Promise<Page>;
};

/**
 * Tags the context's requests to the vault with the play id, so a server tracking play ids
 * (see e2e/README.md) records what the client creates, such as an account registered through
 * the UI, and `play.clean` deletes it. Routing disables the context's HTTP cache, which a
 * fresh context has nothing in anyway.
 */
async function tagRequests(context: BrowserContext, playId: string) {
  const origin = new URL(WEB_VAULT_URL).origin;

  await context.route(
    (url) => url.origin === origin,
    (route) =>
      route.continue({ headers: { ...route.request().headers(), [PLAY_ID_HEADER]: playId } }),
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

    const seeder = await SeederApi.connect();
    try {
      const play = new Play(seeder);
      await use(play);
      await play.clean();
    } finally {
      await seeder.dispose();
    }
  },

  context: async ({ play, context }, use) => {
    await tagRequests(context, play.id);
    await use(context);
  },

  newPage: async ({ play, browser }, use, testInfo) => {
    const contexts: BrowserContext[] = [];

    await use(async () => {
      // The config's options reach this context, but its video setting does not.
      const context = await browser.newContext({ recordVideo: { dir: videoDir(testInfo) } });
      contexts.push(context);
      await tagRequests(context, play.id);

      return context.newPage();
    });

    await Promise.all(contexts.map((context) => context.close()));
    pruneVideo(testInfo);
  },
});
