import type { AccessRequestId } from "../abstractions/access-lease";

import type { AccessDecisionRequest } from "./access-decision.request";
import type { AccessRequestDetailsResponse } from "./responses/access-request.response";

/**
 * The three approver-facing reads and the one approver-facing write, as raw HTTP.
 *
 * TEMPORARY, AND DELIBERATELY NARROW. Every other PAM call in this module goes through the Rust SDK
 * (`client.commercial().pam()`), which is the rule. These three routes are the one exception: the
 * server implements them, but the pinned commercial SDK exposes only caller-scoped operations
 * (`list_mine`, `get`, `activate`, `cancel`, `pre_check`, `request`) and nothing approver-scoped, so
 * there is no SDK call to make. Binding them behind this abstraction means the eventual swap is a
 * provider change in `provide-pam.ts` and nothing else.
 *
 * The exception stops here. Approver-side revoke and cancel-approval are NOT on this contract even
 * though the poc routed them through the same HTTP client, because the SDK already covers them:
 * revoking a lease is `leases().end()` and cancelling an approval is `access_requests().cancel()`,
 * both of which hit the very endpoints the poc called by hand. Any other PAM capability found
 * missing from the SDK is SDK work, not a fourth route here.
 */
export abstract class ApprovalApiService {
  /**
   * `GET /access-requests/inbox` — the requests awaiting the caller's decision. The server scopes
   * this by Manage permission on the request's collection and returns only pending requests, so an
   * empty list is the normal answer for a member who approves nothing.
   */
  abstract listInbox(): Promise<AccessRequestDetailsResponse[]>;

  /**
   * `GET /access-requests/history` — the decided requests for the collections the caller manages.
   * Same response shape as the inbox, not an audit-event shape.
   */
  abstract listHistory(): Promise<AccessRequestDetailsResponse[]>;

  /**
   * `POST /access-requests/{id}/decision` — record an approve or deny, with an optional comment.
   *
   * The response is only partially populated (see {@link AccessRequestDetailsResponse}), so callers
   * should merge its `status`/`resolvedAt`/`decisions` onto the row they already hold rather than
   * replacing it.
   */
  abstract decide(
    id: AccessRequestId,
    request: AccessDecisionRequest,
  ): Promise<AccessRequestDetailsResponse>;
}
