import type { Observable } from "rxjs";

/**
 * Streams the server's "your access changed" push to leasing surfaces: a tick on
 * `NotificationType.RefreshAccessRequest` for the active user, fired on decide, activate,
 * revoke, extend, and cancel.
 *
 * The push carries no vault data or ids, only that something changed, so this stream emits
 * `void` and consumers re-read their own state; it can't be narrowed to one cipher for the same
 * reason.
 *
 * Implementations subscribe once and share the result, with no buffering — a tick with nobody
 * listening is dropped. Feature-flag gating is the consumer's business.
 */
export abstract class AccessEventService {
  /**
   * Emits once per relevant server push. Never completes; consumers manage their own teardown
   * (e.g. `takeUntilDestroyed()`).
   */
  abstract accessChanged$(): Observable<void>;

  /**
   * Emits once per `NotificationType.RefreshApproverInbox` push, sent to everyone who can Manage
   * the collection a request touches, not the requester — an approver usually isn't the requester.
   *
   * Same contract as {@link accessChanged$}: `void`, no replay, never completes.
   */
  abstract approverInboxChanged$(): Observable<void>;
}
