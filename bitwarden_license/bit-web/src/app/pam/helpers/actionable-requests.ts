import type { AccessRequestStatus, AccessRequestView } from "../abstractions/access-lease";

/** The fields deciding whether a request still needs the requester's attention. */
type ActionableRequest = {
  status: AccessRequestStatus;
  leaseNotAfter: string;
};

/**
 * Whether a request still needs something from its requester: it is awaiting a decision, or it was
 * approved and the window it was granted has not yet closed, so activating it would still produce
 * access.
 *
 * An approved request whose window has lapsed is deliberately excluded. The server rejects
 * activating it, so counting it would badge the nav for something the requester cannot act on — the
 * same rule the "My requests" tab applies when it withholds the Start button.
 */
export function isActionableRequest(request: ActionableRequest, now: Date): boolean {
  if (request.status === "pending") {
    return true;
  }
  return request.status === "approved" && Date.parse(request.leaseNotAfter) > now.getTime();
}

/** How many of `requests` still need the requester's attention. See {@link isActionableRequest}. */
export function actionableRequestCount(
  requests: ReadonlyArray<Pick<AccessRequestView, "status" | "leaseNotAfter">>,
  now: Date,
): number {
  return requests.filter((request) => isActionableRequest(request, now)).length;
}
