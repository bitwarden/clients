/**
 * Result contract for `OrganizationInviteService.validateOpenOrgInviteEmailDomain`.
 * The service classifies outcomes into typed kinds so consumers can `switch`
 * exhaustively instead of catching thrown errors and inspecting them.
 *
 * Kinds:
 *  - `allowed` — email's domain is permitted by the link's `AllowedDomains`; auth
 *    may proceed.
 *  - `not-allowed` — domain is not permitted. Layered UX check only — server-side
 *    enforcement runs at accept time regardless.
 *  - `link-invalid` — server returned 404. Link no longer exists or the code doesn't
 *    match (deleted, regenerated, or tampered URL). Callers should clear stashed
 *    open-invite state and surface a dedicated error UI.
 *  - `unexpected` — fallback for unclassified throws; `errorMessage` carries a
 *    best-effort string.
 */
export type OpenOrgInviteValidateEmailDomainResult =
  | { kind: "allowed" }
  | { kind: "not-allowed" }
  | { kind: "link-invalid" }
  | { kind: "unexpected"; errorMessage: string };
