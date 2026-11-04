import type { AccessDecisionRequest } from "@bitwarden/sdk-internal";

import type { AccessRequestId, AccessRequestView } from "./access-lease";

export abstract class ApprovalSdkService {
  /**
   * Pending requests on collections the caller can Manage, scoped by the server. Empty for a
   * member who approves nothing.
   */
  abstract listInbox(): Promise<AccessRequestView[]>;

  /**
   * The approved requests on collections the caller manages that can still give access: not
   * started and inside their window, or behind a live lease, with that lease's extension. The
   * ended ones are {@link listHistory}'s.
   */
  abstract listApproved(): Promise<AccessRequestView[]>;

  /**
   * The ended requests on collections the caller manages, newest first: denied, revoked, canceled,
   * expired or session-ended. An approval still giving access is {@link listApproved}'s.
   */
  abstract listHistory(): Promise<AccessRequestView[]>;

  /**
   * The response is only partially populated, so merge its `status`/`resolvedAt`/`decisions`
   * onto the row already held rather than replacing it.
   */
  abstract decide(id: AccessRequestId, request: AccessDecisionRequest): Promise<AccessRequestView>;
}
