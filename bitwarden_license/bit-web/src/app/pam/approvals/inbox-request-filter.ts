import type { AccessRequestView } from "../abstractions/access-lease";

/** The fields deciding whether an inbox row is still worth a decision. */
type TimeBoundedRequest = Pick<AccessRequestView, "leaseNotAfter">;

/**
 * Whether a request still belongs in the approver's actionable inbox — whether a decision could
 * still produce usable access.
 *
 * A request drops out once its window has fully elapsed, mainly re-evaluating rows that lapse
 * while already loaded, since the inbox endpoint applies the same clock filter at read time and
 * the inbox/badge refresh on pushes, not a timer.
 *
 * Keyed off the timestamp, not `status`, since the inbox endpoint already returns only pending
 * requests.
 */
export function isActionableInboxRequest(request: TimeBoundedRequest, now: Date): boolean {
  return Date.parse(request.leaseNotAfter) > now.getTime();
}
