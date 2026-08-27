import type { AccessRequestView } from "../abstractions/access-lease";

/** The fields deciding whether an inbox row is still worth a decision. */
type TimeBoundedRequest = Pick<AccessRequestView, "leaseNotAfter">;

/**
 * Whether a request still belongs in the approver's actionable inbox — that is, whether a decision
 * could still produce usable access.
 *
 * A request drops out once its requested window has fully elapsed: approving it would grant
 * nothing, and the server now reads it as expired. The inbox endpoint applies the same clock
 * filter at read time, so this mainly re-evaluates rows that lapse while already loaded (the
 * inbox and nav badge refresh on pushes, not on a timer).
 *
 * Keyed off the timestamp rather than `status` on purpose: the inbox endpoint already returns only
 * pending requests, so gating on a status string would risk dropping every row if the server ever
 * serialised that value differently.
 */
export function isActionableInboxRequest(request: TimeBoundedRequest, now: Date): boolean {
  return Date.parse(request.leaseNotAfter) > now.getTime();
}
