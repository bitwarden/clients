import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  catchError,
  debounceTime,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  of,
  switchMap,
} from "rxjs";

import {
  AccessRequestDetailsResponse,
  AccessDecisionRequest,
  AccessLeaseRevokeRequest,
  AccessLeaseStatus,
  PamApiService,
} from "@bitwarden/bit-pam";
import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { ApproverInboxRequestsService } from "./approver-inbox-requests.service";
import { isActionableInboxRequest } from "./inbox-request-filter";

/**
 * The approver inbox's page-scoped view of pending lease requests and decision history.
 *
 * The pending list is not fetched here — it is projected from the one shared
 * {@link ApproverInboxRequestsService.requests$} stream (so the page and the nav badge never
 * double-fetch `GET /access-requests/inbox`): timed-out rows are dropped, names resolved, and the
 * inbox sort applied. The decision history (`GET /access-requests/history`) is page-only, so this
 * service loads it on construction and refreshes it on the same live signals.
 *
 * Cipher and collection names are resolved from local vault state via
 * {@link AccessRequestNameResolver} before rows reach subscribers — no name decryption happens
 * here. No other Vault Data passes through this service.
 */
@Injectable()
export class ApproverInboxService {
  private readonly pamApiService = inject(PamApiService);
  private readonly inboxRequests = inject(ApproverInboxRequestsService);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly nameResolver = inject(AccessRequestNameResolver);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _requests$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  private readonly _history$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);
  private readonly _renderedAt$ = new BehaviorSubject<Date>(new Date());

  /**
   * Collection names back-fill reactively from local vault state (see
   * {@link AccessRequestNameResolver.applyCollectionNames$}), whether that state warms up before or
   * after the rows arrive. Cipher names are resolved on the projection path.
   */
  readonly requests$: Observable<AccessRequestDetailsResponse[]> =
    this.nameResolver.applyCollectionNames$(this._requests$);
  readonly history$: Observable<AccessRequestDetailsResponse[]> =
    this.nameResolver.applyCollectionNames$(this._history$);
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();
  /**
   * Snapshot of "now" stamped on every successful render, so the routed Approvals and Audit log
   * tabs render elapsed/relative-time fields against one consistent reference clock.
   */
  readonly renderedAt$: Observable<Date> = this._renderedAt$.asObservable();
  readonly badgeCount$: Observable<number> = this._requests$.pipe(
    map((rows) => rows.length),
    distinctUntilChanged(),
  );

  constructor() {
    // Pending list: project the shared inbox stream — drop timed-out rows, resolve names, sort —
    // into local state. Optimistic edits (below) operate on that local state; the next shared
    // emission reconciles them with the server.
    this.inboxRequests.requests$
      .pipe(
        switchMap((rows) =>
          // catchError keeps the source subscription alive across a failed projection (e.g. a
          // transient vault-decrypt error) so later emissions still render.
          from(this.projectRequests(rows)).pipe(
            catchError((e: unknown) => {
              this._loadError$.next(e);
              this._loading$.next(false);
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((rows) => {
        this._requests$.next(rows);
        this._renderedAt$.next(new Date());
        this._loading$.next(false);
      });

    // History is page-only: load on construction, then refresh on the same live signals that keep
    // the inbox fresh (a decision this user makes, or a push that a managed request changed).
    merge(of(null), this.liveRefresh$())
      .pipe(
        // Swallow per-refresh failures (loadHistory has already recorded loadError$) so one bad
        // fetch doesn't tear down the live-refresh stream.
        switchMap(() => from(this.loadHistory()).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Re-fetch the shared inbox and the history. Best-effort reconcile hook. */
  async load(): Promise<void> {
    await Promise.all([this.inboxRequests.refresh(), this.loadHistory()]);
  }

  /**
   * Submit a decision; remove the row optimistically. On failure, restore
   * the row in its original position and rethrow so the caller can toast.
   */
  async decideAccessRequest(requestId: string, request: AccessDecisionRequest): Promise<void> {
    const current = this._requests$.value;
    const index = current.findIndex((r) => r.id === requestId);
    if (index === -1) {
      // Already removed (double-click guard); call API anyway to stay
      // consistent with "exactly one network call per click".
      await this.pamApiService.decideAccessRequest(requestId, request);
      return;
    }
    const row = current[index];
    const next = current.slice();
    next.splice(index, 1);
    this._requests$.next(next);
    try {
      const resolved = await this.pamApiService.decideAccessRequest(requestId, request);
      // Decision response only populates status/resolvedAt and the deciding decision (verdict +
      // comment); keep the already-decrypted display fields from the existing row. The approver's
      // name/email back-fills on the next load.
      row.status = resolved.status;
      row.resolvedAt = resolved.resolvedAt;
      row.decisions = resolved.decisions;
      this._history$.next([row, ...this._history$.value]);
    } catch (e) {
      const restored = this._requests$.value.slice();
      restored.splice(index, 0, row);
      this._requests$.next(sortInbox(restored));
      throw e;
    }
  }

  /**
   * Revoke an active lease and drop it out of the Active group optimistically
   * by flipping the produced lease's status to "revoked", so the Revoke button
   * disappears immediately. The next load (or a RefreshApproverInbox push)
   * reconciles with the server.
   */
  async revokeAccessLease(leaseId: string): Promise<void> {
    await this.pamApiService.revokeAccessLease(leaseId, new AccessLeaseRevokeRequest({}));
    const updated = this._history$.value.map((item) => {
      if (item.producedLeaseId === leaseId) {
        item.producedLeaseStatus = AccessLeaseStatus.Revoked;
      }
      return item;
    });
    this._history$.next(updated);
  }

  /**
   * Cancel an approved-but-not-activated request on the approver's behalf (the server records a Deny). Flip the row
   * to "denied" optimistically so it repaints out of the Active/Upcoming groups; the next load reconciles.
   */
  async cancelApprovedRequest(requestId: string): Promise<void> {
    await this.pamApiService.cancelAccessRequest(requestId);
    const updated = this._history$.value.map((item) => {
      if (item.id === requestId) {
        item.status = "denied";
      }
      return item;
    });
    this._history$.next(updated);
  }

  /**
   * Emits whenever the inbox should refresh from a signal other than the shared stream's own
   * triggers: a push to this user as an approver (a managed request changed) or as a requester
   * (one of their own requests/leases changed), and any mutation this client makes. Debounced to
   * coalesce bursts.
   */
  private liveRefresh$(): Observable<unknown> {
    return merge(
      this.notificationsService.notifications$.pipe(
        filter(
          ([notification]) =>
            notification.type === NotificationType.RefreshApproverInbox ||
            notification.type === NotificationType.RefreshAccessRequest,
        ),
      ),
      this.pamApiService.mutations$,
    ).pipe(debounceTime(300));
  }

  private async projectRequests(
    rows: AccessRequestDetailsResponse[],
  ): Promise<AccessRequestDetailsResponse[]> {
    // Drop requests that have timed out (server-marked lapsed, or their requested window has fully
    // elapsed). They belong in history, not the "needs approval" list.
    const now = new Date();
    const actionable = rows.filter((row) => isActionableInboxRequest(row, now));
    await this.nameResolver.resolveDisplayNames(actionable);
    return sortInbox(actionable);
  }

  private async loadHistory(): Promise<void> {
    this._loadError$.next(null);
    try {
      const history = await this.pamApiService.listInboxHistory();
      await this.nameResolver.resolveDisplayNames(history);
      this._history$.next(history);
    } catch (e) {
      this._loadError$.next(e);
      throw e;
    }
  }
}

/**
 * Sort the inbox: oldest pending first (FIFO by submittedAt), secondary
 * by collection name (locale-aware).
 *
 * Exported for testing.
 */
export function sortInbox<
  T extends Pick<AccessRequestDetailsResponse, "submittedAt" | "collectionName">,
>(rows: readonly T[]): T[] {
  return rows.slice().sort((a, b) => {
    const submittedDelta = Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
    if (submittedDelta !== 0) {
      return submittedDelta;
    }
    return (a.collectionName ?? "").localeCompare(b.collectionName ?? "", undefined, {
      sensitivity: "base",
    });
  });
}
