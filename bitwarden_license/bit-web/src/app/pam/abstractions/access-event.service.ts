import type { Observable } from "rxjs";

/**
 * Streams the server's "your access changed" push to leasing surfaces: a tick that fires whenever
 * the server sends a `NotificationType.RefreshAccessRequest` for the active user — the signal it
 * emits on decide, activate, revoke, extend, and cancel.
 *
 * The push deliberately carries NO vault data and no ids, only the fact that something changed, so
 * this stream emits `void` and consumers re-read their own state. That is also why it cannot be
 * narrowed to one cipher: a decision made by an approver says nothing about which item the caller
 * happens to have open.
 *
 * Implementations subscribe once to the underlying push channel and share the result, so several
 * consumers do not multiply upstream work, and inherit reconnect behaviour from that channel. No
 * buffering: a tick that arrives with nobody listening is dropped, matching the rest of the push
 * surface. Feature-flag gating is the consumer's business — this stream is cold until subscribed.
 */
export abstract class AccessEventService {
  /**
   * Emits once per relevant server push. Never completes; consumers manage their own teardown
   * (e.g. `takeUntilDestroyed()`).
   */
  abstract accessChanged$(): Observable<void>;

  /**
   * Emits once per `NotificationType.RefreshApproverInbox` push — the server's other half of the
   * same signal, sent to everyone who can Manage the collection a request touches rather than to
   * the requester. An approver is usually not the requester, so without this the approvals surface
   * would only live-refresh for decisions on the caller's own requests.
   *
   * Same contract as {@link accessChanged$}: `void`, no replay, never completes.
   */
  abstract approverInboxChanged$(): Observable<void>;
}
