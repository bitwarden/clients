/**
 * Result contract for `OrganizationInviteService.validateOpenOrgInviteEmailDomain`. The
 * service classifies outcomes into typed kinds so consumers can `switch` exhaustively
 * instead of catching thrown errors and inspecting them.
 *
 * Kinds:
 *  - `allowed` — the email's domain is permitted by the open org invite link's
 *    `AllowedDomains` configuration; auth may proceed.
 *  - `not-allowed` — the domain is not permitted. Layered UX check only — server-side
 *    enforcement runs at accept time regardless.
 *  - `link-invalid` — the server returned 404. The open org invite link no longer exists
 *    or the code doesn't match (deleted, regenerated, or tampered URL). Callers should
 *    clear their stashed open-invite state and surface a dedicated error UI.
 *  - `unexpected` — any other throw (non-`ErrorResponse`, non-404 status, transport
 *    failure). Carries a best-effort message so the caller can toast and fail open.
 */
export type ValidateOpenOrgInviteEmailDomainResult =
  | { kind: "allowed" }
  | { kind: "not-allowed" }
  | { kind: "link-invalid" }
  | { kind: "unexpected"; errorMessage: string };
