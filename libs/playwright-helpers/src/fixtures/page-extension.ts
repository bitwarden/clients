import { Page, TestFixture } from "@playwright/test";

export function pageExtension(): TestFixture<Page, { page: Page; playId: string }> {
  return async ({ page, playId }, use) => {
    await addInitScriptForPlayId(page, playId);
    await use(page);
  };
}

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
