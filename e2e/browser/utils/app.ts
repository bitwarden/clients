import { AttachedApp, attachOverCdp } from "../../utils/cdp";

// `npm run debug:browser` launches Chrome for Testing with --remote-debugging-port=9200
// and opens the extension popup.
const DEBUG_PORT = 9200;
const EXTENSION_URL_PREFIX = "chrome-extension://";
const START_COMMAND = "npm run test:e2e:browser";

const POPUP_PATH = "popup/index.html";
const BLANK_URL = "about:blank";

// Chrome blocks a chrome-extension:// page loaded before it has finished enabling
// the unpacked extension, and nothing retries that load on its own, so the popup
// is reloaded until it routes.
const POPUP_LOAD_ATTEMPTS = 3;
const POPUP_ROUTE_TIMEOUT = 10_000;

// The extension id is stable for the profile, but nothing in the browser reliably
// reports it: pages come and go, and the MV3 service worker's target disappears
// once it goes idle. So it is remembered from whichever target first showed it.
let extensionId: string | undefined;

/**
 * Attaches to the extension popup in the running debug browser, opening a popup
 * when none is left. The popup is closed both by the extension itself — locking
 * does it — and by detaching, which closes the pages Playwright knows about.
 */
export async function attachToPopup(): Promise<AttachedApp> {
  const app = await attachOverCdp({
    port: DEBUG_PORT,
    urlPrefix: EXTENSION_URL_PREFIX,
    startCommand: START_COMMAND,
    openUrl: await currentPopupUrl(),
  });

  await waitForRoutedPopup(app.page);
  await ensureSpareTab();

  return app;
}

/**
 * Waits for the popup to route, reloading it while it does not. The popup URL
 * carries no hash until Angular has routed and callers branch on the route, so a
 * blocked or half-loaded page has to be retried rather than handed over.
 */
async function waitForRoutedPopup(page: AttachedApp["page"]): Promise<void> {
  for (let attempt = 1; attempt <= POPUP_LOAD_ATTEMPTS; attempt++) {
    try {
      await page.waitForFunction(() => window.location.hash !== "", undefined, {
        timeout: POPUP_ROUTE_TIMEOUT,
      });

      return;
    } catch {
      if (attempt === POPUP_LOAD_ATTEMPTS) {
        throw new Error(`The extension popup never routed: ${page.url()}`);
      }

      await page.reload();
    }
  }
}

/**
 * Keeps one blank tab around. Reopening the popup navigates a spare tab, so the
 * next reopen needs a fresh one — and a browser whose last tab is the popup quits
 * when the extension closes it.
 */
async function ensureSpareTab(): Promise<void> {
  const targets = await fetchTargets();

  if (targets.some((target) => target.url === BLANK_URL)) {
    return;
  }

  await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${BLANK_URL}`, { method: "PUT" });
}

/** Popup URL for a hash route, e.g. `popupUrl(page.url(), "account-security")`. */
export function popupUrl(currentUrl: string, route: string): string {
  // chrome-extension:// URLs have an opaque origin, so URL#origin reads "null";
  // the extension id is the host.
  const { hostname } = new URL(currentUrl);

  return `${EXTENSION_URL_PREFIX}${hostname}/${POPUP_PATH}#/${route}`;
}

/** The popup's own URL, or undefined while the extension id is still unknown. */
async function currentPopupUrl(): Promise<string | undefined> {
  const target = (await fetchTargets()).find((t) => t.url.startsWith(EXTENSION_URL_PREFIX));

  if (target != null) {
    extensionId = new URL(target.url).hostname;
  }

  if (extensionId == null) {
    return undefined;
  }

  return `${EXTENSION_URL_PREFIX}${extensionId}/${POPUP_PATH}`;
}

async function fetchTargets(): Promise<{ url: string }[]> {
  try {
    const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);

    return response.ok ? await response.json() : [];
  } catch {
    return [];
  }
}
