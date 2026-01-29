/**
 * Redirects the user to the SSO cookie vendor endpoint when the window finishes loading.
 *
 * This script listens for the window's load event and automatically redirects the browser
 * to the `/sso_cookie_vendor` path on the current origin. This is used as part
 * of an authentication flow where cookies need to be set or validated through a vendor endpoint.
 */
window.addEventListener("DOMContentLoaded", () => {
  const newUrl = `${window.location.origin}/sso_cookie_vendor`;
  window.location.href = newUrl;
});
