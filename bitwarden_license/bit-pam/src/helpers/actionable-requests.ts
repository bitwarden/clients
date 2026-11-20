import type { AccessRequestView } from "../abstractions/access-lease";

type ActionableRequest = Pick<
  AccessRequestView,
  "status" | "leaseNotAfter" | "producedLeaseId" | "extensionOfLeaseId"
>;

/**
 * An approved request past its window is excluded, since the server rejects activating it.
 * Activation shows in `producedLeaseId`, since an activated request stays `approved`. An approved
 * extension is excluded too: it mints no lease of its own, it moves its parent's end, so it never
 * gains a `producedLeaseId` and would otherwise count until its window closed, even after the
 * parent lease ended.
 */
export function isActionableRequest(request: ActionableRequest, now: Date): boolean {
  if (request.status === "pending") {
    return true;
  }
  return (
    request.status === "approved" &&
    request.extensionOfLeaseId == null &&
    request.producedLeaseId == null &&
    Date.parse(request.leaseNotAfter) > now.getTime()
  );
}
