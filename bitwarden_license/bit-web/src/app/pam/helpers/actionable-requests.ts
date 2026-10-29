import type { AccessRequestView } from "../abstractions/access-lease";

type ActionableRequest = Pick<AccessRequestView, "status" | "leaseNotAfter" | "producedLeaseId">;

/**
 * An approved request past its window is excluded, since the server rejects activating it.
 * Activation shows in `producedLeaseId`, since an activated request stays `approved`.
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
