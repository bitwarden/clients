import { chromium, Browser, Page } from "@playwright/test";

////
// Attaching to an already-running client over the Chrome DevTools protocol. Used
// for the desktop app (Electron) and the extension (Chrome for Testing), both of
// which are launched outside Playwright.
////

export type AttachedApp = {
  page: Page;
  /** Detaches the debugger; the client keeps running. */
  detach: () => Promise<void>;
};

export type AttachOptions = {
  /** Remote debugging port the client was launched with. */
  port: number;
  /** URL prefix of the page to drive; the endpoint also exposes devtools:// targets. */
  urlPrefix: string;
  /** Command that starts the client, named in the error when nothing is listening. */
  startCommand: string;
};

export async function attachOverCdp({
  port,
  urlPrefix,
  startCommand,
}: AttachOptions): Promise<AttachedApp> {
  const endpoint = `http://127.0.0.1:${port}`;
  let browser: Browser;

  try {
    browser = await chromium.connectOverCDP(endpoint);
  } catch {
    throw new Error(`Could not connect to ${endpoint}. Start the client with \`${startCommand}\`.`);
  }

  const page = browser
    .contexts()
    .flatMap((context) => context.pages())
    .find((p) => p.url().startsWith(urlPrefix));

  if (page == null) {
    await browser.close();
    throw new Error(`No page matching "${urlPrefix}" found on ${endpoint}.`);
  }

  return { page, detach: () => browser.close() };
}
