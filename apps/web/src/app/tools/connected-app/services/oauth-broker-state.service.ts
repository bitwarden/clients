import { Injectable } from "@angular/core";

/**
 * Transient handoff from the consent page (`/oauth/authorize`) to the static completion/broker
 * connector (`oauth-complete-connector.html`, the registered `redirect_uri`).
 *
 * The flow navigates away from the SPA (to Identity's consent callback, which then redirects to the
 * registered `redirect_uri`), so the SPA that generated the PSK is torn down before the completion
 * page loads — an in-memory handoff cannot survive. `sessionStorage` is the narrowest mechanism that
 * does: it is same-origin, scoped to this tab, never leaves the browser, and is removed the instant
 * the completion connector consumes it. The plaintext PSK is never persisted to disk and never sent
 * to the Bitwarden server.
 *
 * Keyed by the OAuth `state` so a stale or mismatched completion request can't pick up a PSK. The
 * key names here MUST match the ones the connector reads (`apps/web/src/connectors/oauth-complete.ts`).
 */
@Injectable({ providedIn: "root" })
export class OAuthBrokerStateService {
  private readonly pskKeyPrefix = "oauthBrokerPsk:";
  private readonly redirectKeyPrefix = "oauthBrokerRedirect:";

  /**
   * Stashes the plaintext PSK (and, when known, the agent's loopback redirect) for the given OAuth
   * `state`, for the completion connector to consume.
   */
  set(state: string, psk: string, agentRedirect?: string): void {
    sessionStorage.setItem(this.pskKeyPrefix + state, psk);
    if (agentRedirect != null && agentRedirect.length > 0) {
      sessionStorage.setItem(this.redirectKeyPrefix + state, agentRedirect);
    }
  }

  /**
   * Returns and removes the plaintext PSK for the given `state`. Returns `null` if nothing is held
   * for that `state` (e.g. a stale or forged completion request).
   */
  take(state: string): string | null {
    const key = this.pskKeyPrefix + state;
    const psk = sessionStorage.getItem(key);
    sessionStorage.removeItem(key);
    return psk;
  }

  /** Clears any handoff data held for the given `state`. */
  clear(state: string): void {
    sessionStorage.removeItem(this.pskKeyPrefix + state);
    sessionStorage.removeItem(this.redirectKeyPrefix + state);
  }
}
