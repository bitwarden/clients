// "Login with Bitwarden" completion/broker connector. This is the registered OAuth `redirect_uri`.
//
// Identity redirects here with `?code&state` (plus `session_state`/`iss`) after the user consents.
// Running at a real path (not the Angular hash router), it:
//   1. reads `code`/`state` from the query,
//   2. retrieves the plaintext PSK the consent page stashed in sessionStorage (keyed by `state`),
//   3. forwards the browser to the agent's loopback with `code`/`state` in the query and the PSK in
//      the URL **fragment** (`#psk=...`), then removes the PSK from sessionStorage.
//
// The PSK rides the fragment only, so it never reaches any server. Forwarding is restricted to
// loopback addresses to prevent leaking the secret via an open redirect.

const PSK_KEY_PREFIX = "oauthBrokerPsk:";
const REDIRECT_KEY_PREFIX = "oauthBrokerRedirect:";

window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error != null) {
    showMessage(`Authorization failed: ${error}`);
    return;
  }

  if (!code || !state) {
    showMessage("Missing authorization response. You can close this window.");
    return;
  }

  // Retrieve and immediately clear the plaintext PSK stashed by the consent page.
  const psk = sessionStorage.getItem(PSK_KEY_PREFIX + state);
  sessionStorage.removeItem(PSK_KEY_PREFIX + state);

  // The agent's loopback redirect, stashed by the consent page when the authorize context provides it.
  const agentRedirect = sessionStorage.getItem(REDIRECT_KEY_PREFIX + state);
  sessionStorage.removeItem(REDIRECT_KEY_PREFIX + state);

  if (psk == null) {
    showMessage("Could not complete the connection (missing handoff). You can close this window.");
    return;
  }

  if (agentRedirect != null && isLoopback(agentRedirect)) {
    const separator = agentRedirect.includes("?") ? "&" : "?";
    const target =
      `${agentRedirect}${separator}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}` +
      `#psk=${encodeURIComponent(psk)}`;
    window.location.href = target;
    return;
  }

  // No (valid) agent loopback available — e.g. a manual/dev run. Confirm completion without ever
  // rendering the PSK, which has already been consumed from sessionStorage.
  showMessage("Authorization complete. You can return to the app.");
});

/** Only forward the PSK to loopback addresses, so a bad redirect can't exfiltrate it. */
function isLoopback(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "[::1]"
    );
  } catch {
    return false;
  }
}

function showMessage(message: string): void {
  const spinner = document.getElementById("spinner");
  if (spinner != null) {
    spinner.style.display = "none";
  }
  const messageEl = document.getElementById("message");
  if (messageEl != null) {
    messageEl.textContent = message;
  }
}
