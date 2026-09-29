import { Session } from "electron";

/** Where 1Password serves each account's API: its regions, and Enterprise under `.com`. */
const onePasswordApiUrls = [
  "https://*.1password.com/api/*",
  "https://*.1password.eu/api/*",
  "https://*.1password.ca/api/*",
];

const allowOriginHeader = "access-control-allow-origin";

/**
 * Lets the renderer read 1Password's API responses, which the direct 1Password import needs.
 *
 * The SDK signs in to 1Password and downloads the account with `fetch` from the renderer, but
 * 1Password only answers cross-origin requests from its own web app, so Chromium discards every
 * response. Allowing any origin on those hosts, and only those, lets the import through. The
 * requests carry no cookies, so a wildcard origin exposes nothing a credentialed request would.
 */
export function allowOnePasswordApiAccess(session: Session): void {
  session.webRequest.onHeadersReceived({ urls: onePasswordApiUrls }, (details, callback) => {
    const responseHeaders = Object.fromEntries(
      Object.entries(details.responseHeaders ?? {}).filter(
        ([name]) => name.toLowerCase() !== allowOriginHeader,
      ),
    );
    responseHeaders[allowOriginHeader] = ["*"];
    callback({ responseHeaders });
  });
}
