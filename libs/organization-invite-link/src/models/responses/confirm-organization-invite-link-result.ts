/**
 * The outcome of confirming a user into an organization via an invite link.
 *
 * Mirrors the confirm endpoint's contract: `ok` for a successful confirmation, and a discrete
 * `kind` per failure so callers can switch on the result rather than inspecting raw error strings.
 * Each failure variant carries a `cause` for logging and message construction.
 */
export type ConfirmOrganizationInviteLinkResult =
  | { kind: "ok" }
  | { kind: "invite-link-not-found"; cause: string } // 404
  | { kind: "invite-link-not-available"; cause: string }
  | { kind: "email-domain-not-allowed"; cause: string }
  | { kind: "provider-users-cannot-join"; cause: string }
  | { kind: "organization-access-revoked"; cause: string }
  | { kind: "already-organization-member"; cause: string }
  | { kind: "organization-has-no-available-seats"; cause: string }
  | { kind: "seat-add-failed"; cause: string }
  | { kind: "reset-password-key-required"; cause: string }
  | { kind: "member-of-another-organization"; cause: string }
  | { kind: "single-organization-policy"; cause: string }
  | { kind: "two-factor-required-for-membership"; cause: string }
  | { kind: "only-one-free-organization-admin-allowed"; cause: string }
  | { kind: "unauthorized"; cause: string } // 401/403
  | { kind: "unexpected-error"; cause: string };
