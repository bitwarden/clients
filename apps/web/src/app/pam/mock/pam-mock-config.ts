/**
 * DEMO ONLY — toggle and deterministic predicates for the PAM mock layer.
 *
 * On by default in this demo workspace. To opt out for a session, run:
 *   localStorage.setItem("pam-mock", "false")
 * then reload.
 *
 * `FeatureFlag.Pam` is also defaulted to TRUE in this worktree (see
 * libs/common/src/enums/feature-flag.enum.ts) so the cipher-open interceptor
 * round-trips through the mock without any LaunchDarkly setup.
 */
export const PamMockConfig = {
  isEnabled(): boolean {
    if (typeof localStorage === "undefined") {
      return true;
    }
    return localStorage.getItem("pam-mock") !== "false";
  },

  /**
   * Returns the PAM state for a cipher. Roughly one third of ciphers fall into
   * each gated bucket; the rest are passthrough (not gated at all).
   *
   * - "active"        → pre-seeded active lease; opens with the active-lease banner.
   * - "pre_pending"   → pre-seeded pending request (30 min old); opens with pending banner.
   * - "needs_request" → gated but no request yet; triggers the request-access form.
   * - "passthrough"   → not gated; opens normally.
   */
  stateForCipher(cipherId: string): "active" | "pre_pending" | "needs_request" | "passthrough" {
    const h = hash(cipherId);
    if (h % 6 === 0) {
      return "active";
    }
    if (h % 6 === 1) {
      return "pre_pending";
    }
    if (h % 6 === 2) {
      return "needs_request";
    }
    return "passthrough";
  },

  /** @deprecated Use stateForCipher instead. */
  shouldGate(cipherId: string): boolean {
    return this.stateForCipher(cipherId) !== "passthrough";
  },

  /** @deprecated Use stateForCipher instead. */
  shouldStartWithActiveLease(cipherId: string): boolean {
    return this.stateForCipher(cipherId) === "active";
  },

  /** ~20% of submitted requests auto-deny instead of auto-approve. */
  shouldAutoDeny(requestId: string): boolean {
    return hash(requestId) % 100 < 20;
  },

  /** Delay before the mock auto-decides a pending request. */
  AUTO_DECIDE_DELAY_MS: 4000,

  /** Default lease duration for both seed leases and auto-approved leases. */
  DEFAULT_LEASE_DURATION_MS: 60 * 60 * 1000,
} as const;

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 1000000;
}
