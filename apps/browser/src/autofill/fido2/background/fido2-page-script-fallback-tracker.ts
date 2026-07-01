/**
 * Tracks tabs where the FIDO2 page-script has just triggered a fallback to the
 * browser's native WebAuthn handler.
 *
 * When the page-script is the primary interception path (Firefox, older
 * Chrome, MAIN-world frames) and the user opts out of the Bitwarden picker,
 * the page-script invokes the saved-native `navigator.credentials.{create,get}`
 * directly. On Chrome 115+ with `chrome.webAuthenticationProxy` attached, that
 * native call routes through the proxy and would re-enter Bitwarden, causing
 * the user to see the Bitwarden picker twice. This tracker lets the proxy
 * short-circuit and return `NotAllowedError` so Chrome's native picker takes
 * over for the in-flight fallback.
 *
 * The tracker is constructed unconditionally and shared by `Fido2Background`
 * (always writes) and `Fido2WebAuthnProxyBackground` (reads on Chrome 115+).
 * On Firefox / Safari / older Chrome the reader never runs, so the tracker
 * self-prunes expired entries on every write to keep the Map bounded.
 */
export class Fido2PageScriptFallbackTracker {
  private static readonly TTL_MS = 10_000;
  private readonly pending = new Map<number, number>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  markFallbackInProgress(tabId: number): void {
    const currentTime = this.now();
    this.pruneExpired(currentTime);
    this.pending.set(tabId, currentTime + Fido2PageScriptFallbackTracker.TTL_MS);
  }

  /**
   * Returns true exactly once when a fallback is in progress for the tab,
   * consuming the marker. Expired markers are treated as absent.
   */
  consumeIfPending(tabId: number): boolean {
    const expiresAt = this.pending.get(tabId);
    if (expiresAt == null) {
      return false;
    }
    this.pending.delete(tabId);
    return expiresAt > this.now();
  }

  private pruneExpired(currentTime: number): void {
    for (const [tabId, expiresAt] of this.pending) {
      if (expiresAt <= currentTime) {
        this.pending.delete(tabId);
      }
    }
  }
}
