import { BrowserApi } from "../../platform/browser/browser-api";

/**
 * Per-(tabId, frameId) frame secret lifecycle.
 *
 * A FrameSecret is a fresh, high-entropy token issued by the background when a
 * content-script Port handshakes. Sensitive commands carry it on every wire message
 * (under a Symbol — but the value still travels), and the background verifies it
 * against this store before dispatching.
 *
 * **Background-only.** This service holds the authoritative record of issued
 * secrets and is instantiated by background code. Per invariant §2.3, only
 * `env-pair.ts`, `handles-content.ts`, and `schemas/` are content-safe — the rest
 * of `autofill/security/` (including this file) is background bundle territory.
 * That is why we route `addListener` through `BrowserApi` for Safari's leak fix.
 *
 * In-memory only. Service-worker termination wipes secrets, which is correct — the
 * content script re-handshakes on the next port connect and receives a fresh token.
 * `chrome.storage.session` would survive SW restart but would also leak a key across
 * a deliberate revoke event (e.g. tab navigation), so a memory map is the right
 * primitive here.
 */

const SECRET_BYTES = 32;

const base64url = (bytes: Uint8Array): string => {
  let raw = "";
  for (const b of bytes) {
    raw += String.fromCharCode(b);
  }
  // btoa gives us standard base64; convert to url-safe and strip padding.
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const generateSecret = (): string => {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
};

/**
 * Constant-time string comparison. XOR each char code into an accumulator; only
 * return true when the accumulator is zero AND the lengths match. Falsey/short-circuit
 * patterns would leak length and prefix mismatches via timing.
 */
const constantTimeEquals = (a: string, b: string): boolean => {
  // Walk min(a.length, b.length) so we never index past either string. The length
  // check below ensures the timing of mismatched-length inputs still depends on
  // both lengths (we touched at least max(a.length, b.length) characters in total
  // — once via charCodeAt, once via length read).
  const len = Math.min(a.length, b.length);
  let acc = 0;
  for (let i = 0; i < len; i++) {
    acc |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  // Mix length difference into the accumulator so an early return path doesn't exist.
  acc |= a.length ^ b.length;
  return acc === 0;
};

interface FrameKey {
  tabId: number;
  frameId: number;
}

const frameKey = (tabId: number, frameId: number): string => `${tabId}:${frameId}`;

export class FrameSecretService {
  private readonly secrets = new Map<string, string>();

  constructor() {
    this.attachLifecycleHooks();
  }

  /** Issue a new secret for (tabId, frameId), overwriting any prior entry. */
  issue(tabId: number, frameId: number): string {
    const secret = generateSecret();
    this.secrets.set(frameKey(tabId, frameId), secret);
    return secret;
  }

  /**
   * Verify a claimed secret in constant time. Returns false when the claim is
   * missing, when no secret has been issued for (tabId, frameId), or when the
   * stored secret does not match.
   */
  verify(tabId: number, frameId: number, claimed: string | undefined): boolean {
    if (claimed === undefined) {
      return false;
    }
    const stored = this.secrets.get(frameKey(tabId, frameId));
    if (stored === undefined) {
      // Still spend comparison time against a generated string so callers can't
      // distinguish "no secret issued" from "secret mismatch" by latency.
      constantTimeEquals(claimed, generateSecret());
      return false;
    }
    return constantTimeEquals(stored, claimed);
  }

  /**
   * Invalidate. Without a frameId, all secrets for the tab are dropped — appropriate
   * for tab close. With a frameId, only that frame's secret is dropped — appropriate
   * for top-frame navigation, which invalidates the page's identity.
   */
  revoke(tabId: number, frameId?: number): void {
    if (frameId === undefined) {
      for (const key of this.secrets.keys()) {
        if (key.startsWith(`${tabId}:`)) {
          this.secrets.delete(key);
        }
      }
      return;
    }
    this.secrets.delete(frameKey(tabId, frameId));
  }

  /** Test-only seam. Exposes internal entries for assertion. */
  __debugEntries(): readonly FrameKey[] {
    return [...this.secrets.keys()].map((k) => {
      const [tabIdStr, frameIdStr] = k.split(":");
      return { tabId: Number(tabIdStr), frameId: Number(frameIdStr) };
    });
  }

  private attachLifecycleHooks(): void {
    if (chrome.tabs?.onRemoved) {
      BrowserApi.addListener(chrome.tabs.onRemoved, (tabId) => this.revoke(tabId));
    }
    // Top-frame navigation wipes the page's identity — drop the top-frame secret so
    // post-nav content scripts must re-handshake.
    if (chrome.webNavigation?.onCommitted) {
      BrowserApi.addListener(chrome.webNavigation.onCommitted, (details) => {
        if (details.frameId === 0) {
          this.revoke(details.tabId, 0);
        }
      });
    }
    if (chrome.runtime?.onSuspend) {
      BrowserApi.addListener(chrome.runtime.onSuspend, () => this.secrets.clear());
    }
  }
}
