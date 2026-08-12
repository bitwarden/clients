import { OpenOrgInviteStatus } from "./open-org-invite-status.type";

/**
 * Result contract for
 * `OrganizationInviteService.getOpenOrgInviteStatus(organizationId, code)`. The service
 * classifies outcomes into typed kinds so consumers can `switch` exhaustively instead
 * of catching thrown errors and inspecting them.
 *
 * Kinds mirror the server's `GetStatus` outcomes:
 *  - `ok` — status fetch succeeded; payload on the `status` field. See
 *    {@link OpenOrgInviteStatus}.
 *  - `not-found` — link/org missing or org disabled (server folds all three into
 *    `InviteLinkNotFound` / 404). No org name available.
 *  - `plan-not-supported` — org plan has `UseInviteLinks = false` (server signals via
 *    `LinksEnabled: false` on the 200 payload).
 *  - `no-seats` — org is at its seat cap (server signals via `SeatsAvailable: false`
 *    on the 200 payload).
 *  - `unexpected` — fallback for unclassified throws; `errorMessage` carries a
 *    best-effort string.
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

/**
 * Error arms of {@link OpenOrgInviteStatusResult} — derived via `Exclude` so a new
 * failure kind added to the parent union automatically shows up here.
 */
export type OpenOrgInviteStatusError = Exclude<OpenOrgInviteStatusResult, { kind: "ok" }>;
