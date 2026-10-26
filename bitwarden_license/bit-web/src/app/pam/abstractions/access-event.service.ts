import type { Observable } from "rxjs";

/**
 * Server pushes for the active user's leasing surfaces. A push carries no ids, so ticks are `void`
 * and consumers re-read their own state. Consumers also own feature-flag gating.
 */
export abstract class AccessEventService {
  /**
   * Ticks once per `RefreshAccessRequest` push. Shared without replay, so a tick nobody hears is
   * dropped; never completes.
   */
  abstract accessChanged$(): Observable<void>;

  /**
   * Ticks once per `RefreshApproverInbox` push, sent to everyone who can Manage the request's
   * collection. Same contract as {@link accessChanged$}.
   */
  abstract approverInboxChanged$(): Observable<void>;
}
