/**
 * Result returned by `OrganizationInviteService.acceptOpenOrgInvite`. Consumers should
 * `switch` on `kind` exhaustively; `unexpected` catches unclassified failures so
 * consumers always have a case to render.
 */
export type AcceptOpenOrgInviteResult =
  /** Accept call succeeded and the stashed invite has been cleared. */
  | { kind: "accepted" }
  /**
   * Org has a master-password policy the user hasn't yet satisfied. The invite is
   * stashed and the user has been logged out; the caller need not take further action.
   */
  | { kind: "stashed-for-mp-policy-detour" }
  /**
   * Account-recovery public key returned by the server did not match the org public
   * key thumbprint bound into the invite; indicates key substitution.
   */
  | { kind: "recovery-key-mismatch" }
  | { kind: "link-not-found" }
  | { kind: "plan-not-supported" }
  | { kind: "email-domain-not-allowed" }
  | { kind: "already-member" }
  | { kind: "org-access-revoked" }
  | { kind: "no-seats" }
  | { kind: "two-factor-required" }
  /**
   * User is subject to a single-organization policy from another org that prevents
   * joining a second one.
   */
  | { kind: "single-org-policy-violation" }
  /**
   * User is subject to an auto-confirm policy from another org that prevents this
   * membership.
   */
  | { kind: "auto-confirm-policy-violation" }
  /** Provider users cannot join organizations via invite link. */
  | { kind: "provider-user" }
  /** User can only be an admin of one free organization. */
  | { kind: "free-admin-limit" }
  /**
   * Org requires reset-password enrollment on accept but the client did not supply
   * the required key.
   */
  | { kind: "reset-password-key-required" }
  /**
   * Fallback for unclassified failures (unknown status, unrecognized message, non-error
   * throws). `errorMessage` carries a best-effort user-facing string.
   */
  | { kind: "unexpected"; errorMessage: string };

/**
 * Error arms of {@link AcceptOpenOrgInviteResult} — Derived via
 * `Exclude` so a new failure kind added to the parent union automatically shows up here.
 */
export type AcceptOpenOrgInviteError = Exclude<
  AcceptOpenOrgInviteResult,
  { kind: "accepted" } | { kind: "stashed-for-mp-policy-detour" }
>;
