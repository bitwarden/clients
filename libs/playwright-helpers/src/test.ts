import { test as base } from "@playwright/test";
import { webServerBaseUrl } from "@playwright-config";

import { AuthFixture } from "./fixtures/auth.fixture";
import { pageExtension } from "./fixtures/page-extension";
import { UserStateFixture } from "./fixtures/user-state.fixture";

interface TestParams {
  auth: AuthFixture;
  userState: UserStateFixture;
  playId: string;
}

export let playId: string;

export const test = base.extend<TestParams>({
  auth: AuthFixture.fixtureValue(),
  userState: UserStateFixture.fixtureValue(),
  // eslint-disable-next-line no-empty-pattern
  playId: async ({}, use) => {
    await use(playId!);
  },
  // TODO: we probably need to extend all means of getting a Page to include the playId fetch
  page: pageExtension(),
});

const originalFetch = global.fetch;

base.beforeAll(async () => {
  playId = crypto.randomUUID();
  Object.freeze(playId);

  // override the global fetch to always include the x-play-id header
  // so that any fetch calls made in the test context include the play id
  global.fetch = fetchWithPlayId;
});

// restore the original fetch after all tests are done
base.afterAll(() => {
  global.fetch = originalFetch;
  void cleanStage();
});

async function fetchWithPlayId(
  input: string | URL | globalThis.Request,
  init?: RequestInit,
): Promise<Response> {
  // Build a Request that takes into account both the input and any provided init overrides
  const baseRequest =
    input instanceof globalThis.Request
      ? init
        ? new Request(input, init)
        : input
      : new Request(input, init);

  baseRequest.headers.set("x-play-id", playId!);

  return originalFetch(baseRequest);
}

export async function cleanStage(): Promise<void> {
  if (!playId) {
    throw new Error("Play ID is not set. Cannot clean stage.");
  }

  if (process.env.PLAYWRIGHT_SKIP_CLEAN_STAGE === "1") {
    // eslint-disable-next-line no-console
    console.warn(
      "PLAYWRIGHT_SKIP_CLEAN_STAGE is set, run\n",
      `curl -X DELETE ${new URL(playId, webServerBaseUrl).toString()}\n`,
    );
    return;
  }

  const response = await fetch(new URL(`/seed/seed/${playId}/`, webServerBaseUrl).toString(), {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ playId }),
  });

  if (!response.ok) {
    throw new Error(`Failed to clean stage: ${response.status} ${response.statusText}`);
  }
}
