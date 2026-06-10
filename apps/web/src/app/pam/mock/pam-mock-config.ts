/**
 * DEMO ONLY — toggle and constants for the PAM mock layer.
 *
 * Off by default — the real backend serves these endpoints. To opt back into
 * the mock for an offline demo, run:
 *   localStorage.setItem("pam-mock", "true")
 * then reload.
 *
 * `FeatureFlag.Pam` is also defaulted to TRUE in this worktree (see
 * libs/common/src/enums/feature-flag.enum.ts) so the cipher-open interceptor
 * round-trips without any LaunchDarkly setup.
 *
 * Note: gating is not decided here. Whether a cipher is gated comes from
 * the server via `partialData` on the cipher sync response; the mock layer
 * only fakes the lease/request/inbox transport for already-gated rows.
 */
export const PamMockConfig = {
  isEnabled(): boolean {
    if (typeof localStorage === "undefined") {
      return false;
    }
    return localStorage.getItem("pam-mock") === "true";
  },

  /** ~20% of submitted requests auto-deny instead of auto-approve. */
  shouldAutoDeny(requestId: string): boolean {
    return hash(requestId) % 100 < 20;
  },

  /** Delay before the mock auto-decides a pending request. */
  AUTO_DECIDE_DELAY_MS: 4000,

  /** Default lease duration for both seed leases and activated on-demand leases. */
  DEFAULT_LEASE_DURATION_MS: 60 * 60 * 1000,

  /**
   * Single demo organization that the member-facing flow's requests and leases
   * belong to. Lets the org-wide kill switch / leasing freeze scope correctly
   * without a real org model in the mock.
   */
  MOCK_ORG_ID: "mock-org",

  /**
   * How long after approval an on-demand approved request stays activatable before it
   * auto-expires unused. Mirrors `config.activation deadline` (24h).
   */
  ACTIVATION_DEADLINE_MS: 24 * 60 * 60 * 1000,

  /**
   * How long a pending request stays valid before auto-expiring without a
   * decision. Mirrors `config.request_decision_deadline` (7 days).
   */
  REQUEST_DECISION_DEADLINE_MS: 7 * 24 * 60 * 60 * 1000,
} as const;

function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % 1000000;
}
