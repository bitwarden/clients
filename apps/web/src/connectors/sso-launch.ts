/**
 * SSO launch connector.
 *
 * ONLY relevant when the web vault is served behind a pre-authenticating reverse proxy (the
 * `ssoCookieVendor` communication mode). Native clients (e.g. desktop) launch the system browser
 * here to *begin* an SSO login.
 *
 * The web vault uses hash-based routing, so the SSO screen normally lives at `/#/sso?...`. A native
 * client cannot launch the browser straight at that fragment URL when a pre-auth proxy is in front:
 * the proxy only ever sees the path + query on the wire (`GET /`), so when it has to re-challenge
 * the user it can neither capture nor restore the fragment, and the SSO parameters are silently
 * dropped across the sign-in roundtrip.
 *
 * This connector is a real path + query page (`/sso-launch-connector.html?...`) that the proxy CAN
 * observe and restore. Once the proxy challenge is satisfied the browser lands back here with its
 * query string intact, and we hand off to the SSO hash route with a same-origin, browser-local
 * navigation.
 */
export function initiateSsoLaunch() {
  // Preserve the exact query string (clientId, redirectUri, state, codeChallenge, email, identifier)
  // and forward it to the SSO hash route. window.location.search includes the leading "?".
  window.location.href = `${window.location.origin}/#/sso${window.location.search}`;
}

window.addEventListener("load", () => {
  initiateSsoLaunch();
});
