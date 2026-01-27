import { Page, TestFixture } from "@playwright/test";

/** Creates a fixture method which updates the page fixture to monkey-patch fetch requests to include an `x-play-id` header*/
export function pageExtension(): TestFixture<Page, { page: Page; playId: string }> {
  return async ({ page, playId }, use) => {
    await addInitScriptForPlayId(page, playId);
    await use(page);
  };
}

/** Adds an init script to the given page that monkey-patches fetch requests to include an `x-play-id` header */
export function addInitScriptForPlayId(page: Page, playId: string): Promise<void> {
  return page.addInitScript(
    ({ p }) => {
      const originalFetch = window.fetch;
      window.fetch = async function (input: string | URL | globalThis.Request, init?: RequestInit) {
        // Build a Request that takes into account both the input and any provided init overrides
        const baseRequest =
          input instanceof globalThis.Request
            ? init
              ? new Request(input, init)
              : input
            : new Request(input, init);

        baseRequest.headers.set("x-play-id", p);

        return originalFetch(baseRequest);
      };
    },
    { p: playId },
  );
}
