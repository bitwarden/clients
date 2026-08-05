/**
 * Result contract for `OrganizationInviteService.acceptOpenOrgInvite`. The service
 * classifies outcomes into typed kinds so consumers can `switch` exhaustively instead
 * of catching thrown errors and inspecting them.
 *
 * Kinds:
 *  - `accepted` — invite consumed; stash cleared.
 *  - `stashed-for-mp-policy-detour` — org has an MP policy the user hasn't satisfied;
 *    the invite is stashed and the user has been logged out.
 *  - `recovery-key-mismatch` — account-recovery public key didn't match the org key
 *    thumbprint bound into the invite; indicates key substitution.
 *  - `link-not-found` — invite link no longer exists (server 404).
 *  - `plan-not-supported` — org plan doesn't allow invite links.
 *  - `email-domain-not-allowed` — user's email is outside the org's `AllowedDomains`.
 *  - `already-member` — user is already in the org (success-adjacent).
 *  - `org-access-revoked` — org has revoked the user's access.
 *  - `no-seats` — org is at its seat cap.
 *  - `two-factor-required` — user must enable 2FA before joining.
 *  - `email-not-verified` — user must verify their email address before joining.
 *  - `single-org-policy-violation-target-org` — target org enforces single-organization;
 *    user must leave their other orgs.
 *  - `single-org-policy-violation-other-org` — another org the user belongs to enforces
 *    single-organization; user cannot join this one.
 *  - `auto-confirm-policy-violation-target-org` — target org enforces auto-confirm and
 *    the user has other memberships.
 *  - `auto-confirm-policy-violation-other-org` — another org the user belongs to enforces
 *    auto-confirm.
 *  - `provider-users-disallowed` — provider users cannot join via invite link.
 *  - `free-admin-limit-reached` — user can only be admin of one free org.
 *  - `reset-password-key-required` — org requires reset-password enrollment on accept
 *    but the client didn't supply the key.
 *  - `unexpected` — fallback for unclassified throws; `errorMessage` carries a
 *    best-effort string.
 */
export type OpenOrgInviteAcceptResult =
  | { kind: "accepted" }
  | { kind: "stashed-for-mp-policy-detour" }
  | { kind: "recovery-key-mismatch" }
  | { kind: "link-not-found" }
  | { kind: "plan-not-supported" }
  | { kind: "email-domain-not-allowed" }
  | { kind: "already-member" }
  | { kind: "org-access-revoked" }
  | { kind: "no-seats" }
  | { kind: "two-factor-required" }
  | { kind: "email-not-verified" }
  | { kind: "single-org-policy-violation-target-org" }
  | { kind: "single-org-policy-violation-other-org" }
  | { kind: "auto-confirm-policy-violation-target-org" }
  | { kind: "auto-confirm-policy-violation-other-org" }
  | { kind: "provider-users-disallowed" }
  | { kind: "free-admin-limit-reached" }
  | { kind: "reset-password-key-required" }
  | { kind: "unexpected"; errorMessage: string };

/**
 * Error arms of {@link OpenOrgInviteAcceptResult} — derived via `Exclude` so a new
 * failure kind added to the parent union automatically shows up here.
 */
export type OpenOrgInviteAcceptError = Exclude<
  OpenOrgInviteAcceptResult,
  { kind: "accepted" } | { kind: "stashed-for-mp-policy-detour" }
>;
