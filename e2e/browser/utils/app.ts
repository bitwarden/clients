import { AttachedApp, attachOverCdp } from "../../utils/cdp";

// `npm run debug:browser` launches Chrome for Testing with --remote-debugging-port=9200
// and opens the extension popup.
const DEBUG_PORT = 9200;
const EXTENSION_URL_PREFIX = "chrome-extension://";
const START_COMMAND = "npm run test:e2e:browser";

const POPUP_PATH = "popup/index.html";

/** Attaches to the extension popup in the running debug browser. */
export async function attachToPopup(): Promise<AttachedApp> {
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
