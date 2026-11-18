import type { AccessRequestView, CipherAccessStateView } from "../abstractions/access-lease";

/**
 * The approved request still awaiting Start. An activated request stays `approved` and carries
 * `producedLeaseId`, so activation is never read from the status.
 */
export function unactivatedApprovedRequest(
  state: CipherAccessStateView | null | undefined,
): AccessRequestView | undefined {
  const approved = state?.approvedRequest;
  return approved?.producedLeaseId == null ? approved : undefined;
}
