import type { AccessDecisionRequest } from "@bitwarden/sdk-internal";

import type { AccessRequestId, AccessRequestView } from "./access-lease";

/**
 * The approver-facing surface — the pending inbox, the decided history for the collections the
 * caller manages, and recording a decision — is served by the Rust SDK
 * (`client.commercial().pam().approvals()`).
 */
export abstract class ApprovalSdkService {
  /**
   * The requests awaiting the caller's decision. The server scopes this by Manage permission on
   * the request's collection and returns only pending requests, so an empty list is the normal
   * answer for a member who approves nothing.
   */
  abstract listInbox(): Promise<AccessRequestView[]>;

  /**
   * The decided requests for the collections the caller manages. Same response shape as the
   * inbox, not an audit-event shape.
   */
  abstract listHistory(): Promise<AccessRequestView[]>;

  /**
   * Record an approve or deny, with an optional comment.
   *
   * The response is only partially populated, so callers should merge its
   * `status`/`resolvedAt`/`decisions` onto the row they already hold rather than replacing it.
   */
  abstract decide(id: AccessRequestId, request: AccessDecisionRequest): Promise<AccessRequestView>;
}
