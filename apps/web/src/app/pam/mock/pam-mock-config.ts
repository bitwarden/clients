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

  /** ~15% of ciphers are gated. Deterministic per cipher ID. */
  shouldGate(cipherId: string): boolean {
    return hash(cipherId) % 100 < 15;
  },

  /** Of the gated ciphers, ~25% start with an active lease for the current user. */
  shouldStartWithActiveLease(cipherId: string): boolean {
    return hash(cipherId + ":lease") % 100 < 25;
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
