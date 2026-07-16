import { OpenOrgInviteStatus } from "./open-org-invite-status.type";

/**
 * Result contract for `OrganizationInviteService.getOpenOrgInviteStatus(code)`. The
 * service classifies known server outcomes into typed kinds so consumers can `switch`
 * exhaustively instead of inspecting `ErrorResponse.statusCode`.
 *
 * Kinds mirror the server's `GetStatus` outcomes:
 *  - `not-found` — link/org missing or org disabled (server folds all three into
 *    `InviteLinkNotFound` / 404). No org name available.
 *  - `plan-not-supported` — org plan has `UseInviteLinks = false` (server signals via
 *    `LinksEnabled: false` on the 200 payload).
 *  - `no-seats` — org is at its seat cap (server signals via `SeatsAvailable: false`
 *    on the 200 payload).
 *  - `unexpected` — network failure, 5xx, or non-`ErrorResponse` throw. Carries a
 *    best-effort message for generic display.
 *
 * `linksEnabled` and `seatsAvailable` are *discriminators*, not payload data on `ok` —
 * keeping them on the payload would let contradictory states like
 * `{ kind: "ok", status: { seatsAvailable: false, ... } }` typecheck. See
 * {@link OpenOrgInviteStatus}.
 */
export type OpenOrgInviteStatusResult =
  | { kind: "ok"; status: OpenOrgInviteStatus }
  | { kind: "not-found" }
  | { kind: "plan-not-supported"; organizationName: string }
  | { kind: "no-seats"; organizationName: string }
  | { kind: "unexpected"; errorMessage: string };
