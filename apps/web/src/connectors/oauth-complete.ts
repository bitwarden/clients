// "Login with Bitwarden" completion/broker connector. This is the registered OAuth `redirect_uri`.
//
// Identity redirects here with `?code&state` (plus `iss`) on success, or `?error&state` on failure,
// after the user consents. Running at a real path (not the Angular hash router), it:
//   1. reads `code`/`state`/`iss` (or `error`) from the query,
//   2. retrieves the plaintext PSK the consent page stashed in sessionStorage (keyed by `state`),
//   3. forwards the browser to the agent's loopback with `code`/`state`/`iss` in the query and the PSK
//      in the URL **fragment** (`#psk=...`), then removes the PSK from sessionStorage. On an error
//      response it forwards `error`/`error_description` instead (never a PSK) so the agent stops waiting.
//
// The PSK rides the fragment only, so it never reaches any server. Forwarding is restricted to
// loopback http(s) addresses to prevent leaking the secret via an open redirect or non-http scheme.

const PSK_KEY_PREFIX = "oauthBrokerPsk:";
const REDIRECT_KEY_PREFIX = "oauthBrokerRedirect:";

window.addEventListener("load", () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");
  const errorDescription = params.get("error_description");
  // RFC 9207 authorization-server issuer identification: forward it so the agent can validate it.
  const iss = params.get("iss");

  if (!state) {
    showMessage(
      error != null
        ? `Authorization failed: ${error}`
        : "Missing authorization response. You can close this window.",
    );
    return;
  }

  // Retrieve and immediately clear the plaintext PSK + agent loopback stashed by the consent page.
  const psk = sessionStorage.getItem(PSK_KEY_PREFIX + state);
  sessionStorage.removeItem(PSK_KEY_PREFIX + state);
  const agentRedirect = sessionStorage.getItem(REDIRECT_KEY_PREFIX + state);
  sessionStorage.removeItem(REDIRECT_KEY_PREFIX + state);

  const canForward = agentRedirect != null && isLoopback(agentRedirect);

  // On an error response, forward the failure to the agent (never a PSK) so it stops waiting.
  if (error != null) {
    if (canForward) {
      forward(
        agentRedirect,
        buildQuery({ error, error_description: errorDescription, state, iss }),
      );
    } else {
      showMessage(`Authorization failed: ${error}`);
    }
    return;
  }

  if (!code) {
    showMessage("Missing authorization response. You can close this window.");
    return;
  }

  if (psk == null) {
    showMessage("Could not complete the connection (missing handoff). You can close this window.");
    return;
  }

  if (canForward) {
    // PSK rides the fragment only (never the query/server); code/state/iss ride the query.
    forward(agentRedirect, buildQuery({ code, state, iss }), psk);
    return;
  }

  // No (valid) agent loopback available — e.g. a manual/dev run. Confirm completion without ever
  // rendering the PSK, which has already been consumed from sessionStorage.
  showMessage("Authorization complete. You can return to the app.");
});

/** Navigates to the agent loopback, appending the query and, when present, the PSK in the fragment. */
function forward(agentRedirect: string, query: string, psk?: string): void {
  const separator = agentRedirect.includes("?") ? "&" : "?";
  const fragment = psk != null ? `#psk=${encodeURIComponent(psk)}` : "";
  window.location.href = `${agentRedirect}${separator}${query}${fragment}`;
}

/** Builds a query string from the defined, non-empty params, URL-encoding keys and values. */
function buildQuery(params: Record<string, string | null | undefined>): string {
  return Object.entries(params)
    .filter(([, value]) => value != null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value as string)}`)
    .join("&");
}

/**
 * Only forward to loopback addresses, so a bad redirect can't exfiltrate the PSK. The scheme is pinned
 * to http(s) so a non-http URL that carries a loopback "host" (e.g. `javascript://localhost/...`)
 * can't run script on the vault origin or otherwise capture the secret.
 */
function isLoopback(url: string): boolean {
  try {
    const parsed = new URL(url);
    const loopbackHost =
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "[::1]";
    return loopbackHost && (parsed.protocol === "http:" || parsed.protocol === "https:");
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
