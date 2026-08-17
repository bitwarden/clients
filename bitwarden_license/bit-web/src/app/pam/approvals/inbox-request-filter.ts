import type { AccessRequestView } from "../abstractions/access-lease";

/** The fields deciding whether an inbox row is still worth a decision. */
type TimeBoundedRequest = Pick<AccessRequestView, "leaseNotAfter"> & { expiredAt?: string };

/**
 * Whether a request still belongs in the approver's actionable inbox — that is, whether a decision
 * could still produce usable access.
 *
 * A request drops out once it has timed out, either because the server marked it lapsed (`expiredAt`
 * set: the decision deadline passed while it was pending) or because its requested window has fully
 * elapsed, so approving it would grant nothing. Such a request belongs in history, not the "needs
 * approval" list; leaving it in strands it there, and a stale duplicate for the same cipher renders
 * un-actionable and can never be moved on.
 *
 * Keyed off the timestamps rather than `status` on purpose: the inbox endpoint already returns only
 * pending requests, so gating on a status string would risk dropping every row if the server ever
 * serialised that value differently.
 */
export function isActionableInboxRequest(request: TimeBoundedRequest, now: Date): boolean {
  if (request.expiredAt != null) {
    return false;
  }
  return Date.parse(request.leaseNotAfter) > now.getTime();
}
