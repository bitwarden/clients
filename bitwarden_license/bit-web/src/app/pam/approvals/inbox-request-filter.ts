import type { AccessRequestView } from "../abstractions/access-lease";

type TimeBoundedRequest = Pick<AccessRequestView, "leaseNotAfter">;

/**
 * Whether a decision could still produce usable access. Catches rows that lapse after loading;
 * the inbox endpoint applies the same filter at read time and returns only pending requests.
 */
export function isActionableInboxRequest(request: TimeBoundedRequest, now: Date): boolean {
  return Date.parse(request.leaseNotAfter) > now.getTime();
}
