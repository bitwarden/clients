import { OpenOrgInviteStatusResponse } from "./open-org-invite-status.response";

/**
 * Result contract returned by `OrganizationInviteService.getOpenInviteStatus(code)`.
 * The service classifies known server outcomes into typed kinds so consumers can
 * `switch` exhaustively instead of reaching into `ErrorResponse.statusCode`.
 *
 * The failure taxonomy mirrors the outcomes the server's `GetStatus` endpoint can
 * emit:
 *  - `not-found` — link doesn't exist, org doesn't exist, or org is disabled
 *    (server folds all three into `InviteLinkNotFound` / 404).
 *  - `plan-not-supported` — org exists but the plan has `UseInviteLinks = false`
 *    (`InviteLinkNotAvailable` / 400).
 *
 * Anything else — network failure, 5xx, non-`ErrorResponse` throw — surfaces as
 * `unexpected` with a best-effort `errorMessage` for logging and generic display.
 *
 * TODO: PM-39815 will change how `plan-not-supported` is sourced (moves from a
 * 400 error to a boolean field on the success payload). Update the description
 * of that kind above when the server change lands.
 */
export type OpenOrgInviteStatusResult =
  | { kind: "ok"; status: OpenOrgInviteStatusResponse }
  | { kind: "not-found" }
  | { kind: "plan-not-supported" }
  | { kind: "unexpected"; errorMessage: string };
