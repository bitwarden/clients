import { AccessRequestDetailsResponse } from "@bitwarden/pam";

/**
 * Whether a request still belongs in the approver inbox — i.e. a decision can
 * still produce usable access.
 *
 * A request drops out of the actionable list when it has timed out:
 *  - the server explicitly marked it lapsed (`expiredAt` set: the decision
 *    deadline passed while it was pending), or
 *  - its requested window has fully elapsed (`requestedNotAfter` in the past),
 *    so approving it would grant nothing.
 *
 * Such a request belongs in the inbox history, not the "needs approval" list.
 * Leaving it in the actionable list strands it there: a stale duplicate for the
 * same cipher renders un-actionable and so can never be moved to history.
 *
 * Deliberately keyed off the timestamp fields rather than `status`: the inbox
 * endpoint already returns only pending requests, and gating on a status string
 * would drop every row if the server ever serialised the value differently.
 */
export function isActionableInboxRequest(
  request: Pick<AccessRequestDetailsResponse, "requestedNotAfter" | "expiredAt">,
  now: Date,
): boolean {
  if (request.expiredAt != null) {
    return false;
  }
  if (request.requestedNotAfter != null && Date.parse(request.requestedNotAfter) <= now.getTime()) {
    return false;
  }
  return true;
}
