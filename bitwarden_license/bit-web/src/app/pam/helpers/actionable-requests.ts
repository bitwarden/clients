import type { AccessRequestView } from "../abstractions/access-lease";

/** The fields deciding whether a request still needs the requester's attention. */
type ActionableRequest = Pick<AccessRequestView, "status" | "leaseNotAfter" | "producedLeaseId">;

/**
 * Whether a request still needs something from its requester: awaiting a decision, or approved,
 * not yet activated, with a window that hasn't closed.
 *
 * An approved request past its window is excluded, since the server rejects activating it — the
 * same rule "My requests" applies when it withholds Start.
 *
 * Checked via `producedLeaseId`, not status, since an activated request stays `approved`.
 */
export function isActionableRequest(request: ActionableRequest, now: Date): boolean {
  if (request.status === "pending") {
    return true;
  }
  return (
    request.status === "approved" &&
    request.producedLeaseId == null &&
    Date.parse(request.leaseNotAfter) > now.getTime()
  );
}
