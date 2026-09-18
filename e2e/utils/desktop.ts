import { chromium, Browser, Page } from "@playwright/test";

// `npm run debug:desktop` launches Electron with --remote-debugging-port=9222.
const CDP_ENDPOINT = "http://127.0.0.1:9222";
const RENDERER_URL_PREFIX = "file://";

export type DesktopApp = {
  page: Page;
  /** Detaches the debugger; the app keeps running. */
  detach: () => Promise<void>;
};

/** Attaches to the already-running desktop app and returns its renderer page. */
export async function attachToDesktop(): Promise<DesktopApp> {
  let browser: Browser;

  try {
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  } catch {
    throw new Error(
      `Could not connect to ${CDP_ENDPOINT}. Start the app with \`npm run debug:desktop\` first.`,
    );
  }

  // The endpoint also exposes devtools:// targets; keep only the renderer.
  const page = browser
    .contexts()
    .flatMap((context) => context.pages())
    .find((p) => p.url().startsWith(RENDERER_URL_PREFIX));

  if (page == null) {
    await browser.close();
    throw new Error("No renderer page found on the debug endpoint.");
  }

  return { page, detach: () => browser.close() };
}
