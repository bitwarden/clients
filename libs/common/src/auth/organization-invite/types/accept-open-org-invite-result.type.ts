/**
 * Result contract returned by `OrganizationInviteService.acceptOpenOrgInvite`.
 * The service classifies known outcomes into typed kinds so consumers can
 * `switch` exhaustively instead of catching an error object and inspecting it.
 *
 * Client-side kinds:
 *  - `accepted` — the accept call succeeded and the invite has been cleared.
 *  - `stashed-for-mp-policy-detour` — the org has an MP policy the user hasn't
 *    yet satisfied. The invite is stashed and the user has been logged out; the
 *    caller need not take further action.
 *
 * SDK-native kind:
 *  - `recovery-key-mismatch` — the account-recovery public key returned by the
 *    server did not match the org public key thumbprint bound into the invite,
 *    so the SDK refused to enroll. Distinct security condition; means the org
 *    key was substituted.
 *
 * Server-classified kinds — mirror the errors defined at:
 *  - `server/src/Core/AdminConsole/OrganizationFeatures/InviteLinks/Errors.cs`
 *  - `server/src/Core/AdminConsole/OrganizationFeatures/OrganizationUsers/AcceptMembership/Errors.cs`
 *  - `server/src/Core/AdminConsole/OrganizationFeatures/OrganizationUsers/AutoConfirmUser/Errors.cs`
 *  - `server/src/Core/AdminConsole/OrganizationFeatures/Policies/PolicyRequirements/Errors/SingleOrganizationPolicyErrors.cs`
 *
 * The accept call is owned by the SDK (`InviteLinkClient.accept_and_optionally_confirm`),
 * which surfaces HTTP failures as a display-formatted string of the form
 * `Received error message from server: [{status}] {server-message}`. The classifier
 * unwraps that once and then matches on the exact server strings below — the union
 * type IS the server contract. Any message change or unrecognized status falls
 * through to `unexpected` and the server's raw text is surfaced, so failures
 * degrade gracefully instead of breaking.
 */
export type AcceptOpenOrgInviteResult =
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
  | { kind: "single-org-policy-violation" }
  | { kind: "auto-confirm-policy-violation" }
  | { kind: "provider-user" }
  | { kind: "free-admin-limit" }
  | { kind: "reset-password-key-required" }
  | { kind: "unexpected"; errorMessage: string };

/**
 * Error arms of {@link AcceptOpenOrgInviteResult} — Derived via
 * `Exclude` so a new failure kind added to the parent union automatically shows up here.
 */
export type AcceptOpenOrgInviteError = Exclude<
  AcceptOpenOrgInviteResult,
  { kind: "accepted" } | { kind: "stashed-for-mp-policy-detour" }
>;
