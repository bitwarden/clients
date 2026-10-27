import type { AccessDecisionRequest } from "@bitwarden/sdk-internal";

import type { AccessRequestId, AccessRequestView } from "./access-lease";

export abstract class ApprovalSdkService {
  /**
   * Pending requests on collections the caller can Manage, scoped by the server. Empty for a
   * member who approves nothing.
   */
  abstract listInbox(): Promise<AccessRequestView[]>;

  /** The decided requests on collections the caller manages. */
  abstract listHistory(): Promise<AccessRequestView[]>;

  /**
   * The response is only partially populated, so merge its `status`/`resolvedAt`/`decisions`
   * onto the row already held rather than replacing it.
   */
  abstract decide(id: AccessRequestId, request: AccessDecisionRequest): Promise<AccessRequestView>;
}
