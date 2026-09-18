import { chromium, Browser, Page } from "@playwright/test";

////
// Attaching to an already-running client over the Chrome DevTools protocol. Used
// for the desktop app (Electron) and the extension (Chrome for Testing), both of
// which are launched outside Playwright.
////

const BLANK_URL = "about:blank";

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
  /**
   * Page to open when the client has none matching `urlPrefix`. For clients whose
   * page is transient — the extension popup closes itself — rather than a window
   * that is simply always there.
   */
  openUrl?: string;
};

export async function attachOverCdp({
  port,
  urlPrefix,
  startCommand,
  openUrl,
}: AttachOptions): Promise<AttachedApp> {
  const endpoint = `http://127.0.0.1:${port}`;
  let browser: Browser;

  try {
    browser = await chromium.connectOverCDP(endpoint);
  } catch {
    throw new Error(`Could not connect to ${endpoint}. Start the client with \`${startCommand}\`.`);
  }

  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((p) => p.url().startsWith(urlPrefix));

  if (page != null) {
    return { page, detach: () => browser.close() };
  }

  if (openUrl == null) {
    await browser.close();
    throw new Error(`No page matching "${urlPrefix}" found on ${endpoint}.`);
  }

  // Navigate a spare tab rather than opening one: a page created over CDP lands in
  // a fresh browser context, where extensions are disabled and a chrome-extension
  // URL is blocked outright. Launchers leave a blank tab behind for this.
  const spare = pages.find((p) => p.url() === BLANK_URL);

  if (spare == null) {
    await browser.close();
    throw new Error(
      `No page matching "${urlPrefix}" and no ${BLANK_URL} tab to open it in on ${endpoint}.`,
    );
  }

  await spare.goto(openUrl);

  return { page: spare, detach: () => browser.close() };
}
