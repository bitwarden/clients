/**
 * Result contract returned by `OrganizationInviteService.acceptOpenOrgInvite`.
 * The service classifies known server outcomes into typed kinds so consumers can
 * `switch` exhaustively instead of catching `ErrorResponse` and inspecting the
 * status code or message.
 *
 * Client-side kinds:
 *  - `accepted` — the accept call succeeded and the invite has been cleared.
 *  - `stashed-for-mp-policy-detour` — the org has an MP policy the user hasn't
 *    yet satisfied. The invite is stashed and the user has been logged out; the
 *    caller need not take further action.
 *
 * Server-classified kinds — mirror the errors defined at:
 *  - `server/src/Core/AdminConsole/OrganizationFeatures/InviteLinks/Errors.cs`
 *  - `server/src/Core/AdminConsole/OrganizationFeatures/OrganizationUsers/AcceptMembership/Errors.cs`
 *  - `server/src/Core/AdminConsole/OrganizationFeatures/OrganizationUsers/AutoConfirmUser/Errors.cs`
 *  - `server/src/Core/AdminConsole/OrganizationFeatures/Policies/PolicyRequirements/Errors/SingleOrganizationPolicyErrors.cs`
 *
 * Because the server does not currently emit a stable error code (all business
 * failures share the `{ message: "..." }` body shape), classification depends on
 * matching the exact server strings. Any server-message change or new error
 * lands in `unexpected` and the server's raw text is surfaced — failures degrade
 * gracefully instead of breaking.
 */
export type AcceptOpenOrgInviteResult =
  | { kind: "accepted" }
  | { kind: "stashed-for-mp-policy-detour" }
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
