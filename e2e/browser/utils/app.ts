import { AttachedApp, attachOverCdp } from "../../utils/cdp";

// `npm run debug:browser` launches Chrome for Testing with --remote-debugging-port=9200
// and opens the extension popup.
const DEBUG_PORT = 9200;
const EXTENSION_URL_PREFIX = "chrome-extension://";
const START_COMMAND = "npm run test:e2e:browser";

const POPUP_PATH = "popup/index.html";

const SERVICE_WORKER_TARGET = "service_worker";

/** Attaches to the extension popup in the running debug browser. */
export async function attachToPopup(): Promise<AttachedApp> {
  await ensurePopupTab();

  const app = await attachOverCdp({
    port: DEBUG_PORT,
    urlPrefix: EXTENSION_URL_PREFIX,
    startCommand: START_COMMAND,
  });

  // The popup URL carries no hash until Angular has routed, and callers branch
  // on the route, so wait for it before handing the page over.
  await app.page.waitForFunction(() => window.location.hash !== "");

  return app;
}

/** Popup URL for a hash route, e.g. `popupUrl(page.url(), "account-security")`. */
export function popupUrl(currentUrl: string, route: string): string {
  // chrome-extension:// URLs have an opaque origin, so URL#origin reads "null";
  // the extension id is the host.
  const { hostname } = new URL(currentUrl);

  return `${EXTENSION_URL_PREFIX}${hostname}/${POPUP_PATH}#/${route}`;
}

/**
 * Opens a popup tab when none is left. Detaching closes the pages Playwright knows
 * about, so the tab the launcher opened is gone for whoever attaches next — a
 * second test worker, or a retry.
 */
async function ensurePopupTab(): Promise<void> {
  const targets = await fetchTargets();

  if (targets.some((target) => target.url.startsWith(EXTENSION_URL_PREFIX))) {
    return;
  }

  // The extension id is the host of its service worker, which outlives every page.
  const worker = targets.find(
    (target) =>
      target.type === SERVICE_WORKER_TARGET && target.url.startsWith(EXTENSION_URL_PREFIX),
  );

  if (worker == null) {
    throw new Error(
      `No extension found on port ${DEBUG_PORT}. Start the client with \`${START_COMMAND}\`.`,
    );
  }

  const { hostname } = new URL(worker.url);
  await fetch(
    `http://127.0.0.1:${DEBUG_PORT}/json/new?${EXTENSION_URL_PREFIX}${hostname}/${POPUP_PATH}`,
    { method: "PUT" },
  );
}

async function fetchTargets(): Promise<{ type: string; url: string }[]> {
  const response = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`);

  return response.ok ? await response.json() : [];
}
