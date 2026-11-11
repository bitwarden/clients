import type { AccessDecisionRequest, AccessRequestRevokeRequest } from "@bitwarden/sdk-internal";

import type {
  AccessRequestHistoryPage,
  AccessRequestHistoryQuery,
  AccessRequestId,
  AccessRequestView,
} from "./access-lease";

export abstract class ApprovalSdkService {
  /**
   * Pending requests on collections the caller can Manage, scoped by the server. Empty for a
   * member who approves nothing.
   */
  abstract listInbox(): Promise<AccessRequestView[]>;

  /**
   * The approved requests on collections the caller manages that can still give access: not
   * started and inside their window, or behind a live lease, with that lease's extension.
   */
  abstract listApproved(): Promise<AccessRequestView[]>;

  /**
   * One page of the ended requests on collections the caller manages and among their own, newest
   * end first, with the total and the filter options.
   */
  abstract listHistory(query: AccessRequestHistoryQuery): Promise<AccessRequestHistoryPage>;

  /**
   * The response is only partially populated, so merge its `status`/`resolvedAt`/`decisions`
   * onto the row already held rather than replacing it.
   */
  abstract decide(id: AccessRequestId, request: AccessDecisionRequest): Promise<AccessRequestView>;

  /**
   * Withdraws an approval the requester has not started. The server records it as the approver's
   * deny decision and shows the reason to the requester.
   */
  abstract revoke(id: AccessRequestId, request: AccessRequestRevokeRequest): Promise<void>;
}
