import type { AccessRequestView } from "../abstractions/access-lease";

/** The fields deciding whether a request still needs the requester's attention. */
type ActionableRequest = Pick<AccessRequestView, "status" | "leaseNotAfter" | "producedLeaseId">;

/**
 * Whether a request still needs something from its requester: it is awaiting a decision, or it was
 * approved, not yet activated, and the window it was granted has not yet closed, so activating it
 * would still produce access.
 *
 * An approved request whose window has lapsed is deliberately excluded. The server rejects
 * activating it, so counting it would badge the nav for something the requester cannot act on — the
 * same rule the "My requests" tab applies when it withholds the Start button.
 *
 * Activation does not change the status — an activated request stays `approved` and is recognised by
 * the lease it minted — so `producedLeaseId` is what separates "still to start" from "already
 * running". Without it the badge would keep counting a grant the requester has already activated.
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

/** How many of `requests` still need the requester's attention. See {@link isActionableRequest}. */
export function actionableRequestCount(
  requests: ReadonlyArray<ActionableRequest>,
  now: Date,
): number {
  return requests.filter((request) => isActionableRequest(request, now)).length;
}
