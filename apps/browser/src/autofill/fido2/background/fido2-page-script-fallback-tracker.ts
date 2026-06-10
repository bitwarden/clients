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
 */
export class Fido2PageScriptFallbackTracker {
  private static readonly TTL_MS = 10_000;
  private readonly pending = new Map<number, number>();

  constructor(private readonly now: () => number = () => Date.now()) {}

  /** Mark a tab as actively falling back to the browser's native picker. */
  markFallbackInProgress(tabId: number): void {
    this.pending.set(tabId, this.now() + Fido2PageScriptFallbackTracker.TTL_MS);
  }

  /**
   * Returns true exactly once when a fallback is in progress for the tab,
   * consuming the marker. Expired markers are cleaned up lazily and treated
   * as absent.
   */
  consumeIfPending(tabId: number): boolean {
    const expiresAt = this.pending.get(tabId);
    if (expiresAt == null) {
      return false;
    }
    this.pending.delete(tabId);
    return expiresAt > this.now();
  }

  /** Test helper. */
  clear(): void {
    this.pending.clear();
  }
}
