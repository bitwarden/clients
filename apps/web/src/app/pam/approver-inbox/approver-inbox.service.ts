import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, distinctUntilChanged, map } from "rxjs";

import {
  AccessRequestDetailsResponse,
  AccessDecisionRequest,
  AccessLeaseRevokeRequest,
  AccessLeaseStatus,
  PamApiService,
} from "@bitwarden/pam";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { isActionableInboxRequest } from "./inbox-request-filter";

/**
 * Loads pending lease requests for the approver inbox, applies the
 * inbox sort (oldest first, then collection name), and manages optimistic
 * removal + rollback on decision submission.
 *
 * Cipher and collection names are resolved from local vault state via
 * {@link AccessRequestNameResolver} before rows reach subscribers — no name
 * decryption happens here. No other Vault Data passes through this service.
 */
@Injectable()
export class ApproverInboxService {
  private readonly pamApiService = inject(PamApiService);
  private readonly nameResolver = inject(AccessRequestNameResolver);

  private readonly _requests$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  private readonly _history$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  /**
   * Collection names back-fill reactively from local vault state (see
   * {@link AccessRequestNameResolver.applyCollectionNames$}), whether that state warms up before or
   * after the load populates the rows. Cipher names are resolved on the one-shot load path.
   */
  readonly requests$: Observable<AccessRequestDetailsResponse[]> =
    this.nameResolver.applyCollectionNames$(this._requests$);
  readonly history$: Observable<AccessRequestDetailsResponse[]> =
    this.nameResolver.applyCollectionNames$(this._history$);
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();
  readonly badgeCount$: Observable<number> = this._requests$.pipe(
    map((rows) => rows.length),
    distinctUntilChanged(),
  );

  /** Fetch the inbox and history, resolve display names from vault state, replace local state. */
  async load(): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const [rows, history] = await Promise.all([
        this.pamApiService.listInboxRequests(),
        this.pamApiService.listInboxHistory(),
      ]);
      // Drop requests that have timed out (server-marked lapsed, or their
      // requested window has fully elapsed). They belong in history, not the
      // "needs approval" list — keeping them here would strand a stale duplicate
      // for the same cipher that can never be acted on.
      const now = new Date();
      const actionable = rows.filter((row) => isActionableInboxRequest(row, now));
      // Resolve names across both lists in one pass (one vault + collection snapshot).
      await this.nameResolver.resolveDisplayNames([...actionable, ...history]);
      this._requests$.next(sortInbox(actionable));
      this._history$.next(history);
    } catch (e) {
      this._loadError$.next(e);
      throw e;
    } finally {
      this._loading$.next(false);
    }
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
      // Decision response only populates status/resolvedAt/approverComment;
      // keep the already-decrypted display fields from the existing row.
      row.status = resolved.status;
      row.resolvedAt = resolved.resolvedAt;
      row.approverComment = resolved.approverComment;
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
