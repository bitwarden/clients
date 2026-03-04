/**
 * ONLY FOR SELF-HOSTED SETUPS
 * Redirects the user to the SSO cookie vendor endpoint when the window finishes loading.
 *
 * This script listens for the window's load event and automatically redirects the browser
 * to the `api/sso-cookie-vendor` path on the current origin. This is used as part
 * of an authentication flow where cookies need to be set or validated through a vendor endpoint.
 */
window.addEventListener("DOMContentLoaded", () => {
  const origin = window.location.origin;
  let apiURL = `${window.location.origin}/api/sso-cookie-vendor`;
  // Override for local testing
  if (origin.startsWith("https://localhost")) {
    apiURL = "http://localhost:4000/sso-cookie-vendor";
  }
  window.location.href = apiURL;
});
