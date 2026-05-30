import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, distinctUntilChanged, map } from "rxjs";

import {
  InboxAccessRequestResponse,
  LeaseDecisionRequest,
  LeaseRevokeRequest,
  PamApiService,
} from "@bitwarden/pam";

/**
 * Loads pending lease requests for the approver inbox, applies the
 * inbox sort (oldest first, then collection name), and manages optimistic
 * removal + rollback on decision submission.
 *
 * The service holds only display metadata returned by the inbox endpoint
 * (cipher name, collection name, requester name + email). No decrypted
 * Vault Data passes through it.
 */
@Injectable()
export class ApproverInboxService {
  private readonly pamApiService = inject(PamApiService);

  private readonly _requests$ = new BehaviorSubject<InboxAccessRequestResponse[]>([]);
  private readonly _history$ = new BehaviorSubject<InboxAccessRequestResponse[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly requests$: Observable<InboxAccessRequestResponse[]> = this._requests$.asObservable();
  readonly history$: Observable<InboxAccessRequestResponse[]> = this._history$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();
  readonly badgeCount$: Observable<number> = this._requests$.pipe(
    map((rows) => rows.length),
    distinctUntilChanged(),
  );

  /** Fetch the inbox and history, replacing local state. */
  async load(): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const [rows, history] = await Promise.all([
        this.pamApiService.listInboxRequests(),
        this.pamApiService.listInboxHistory(),
      ]);
      this._requests$.next(sortInbox(rows));
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
  async decideAccessRequest(requestId: string, request: LeaseDecisionRequest): Promise<void> {
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
      // Mutate a copy of the inbox row with the server-returned decision fields
      // and prepend it to history so the approver sees it immediately.
      row.status = resolved.status;
      row.resolvedAt = resolved.resolvedAt;
      row.resolverComment = resolved.resolverComment;
      this._history$.next([row, ...this._history$.value]);
    } catch (e) {
      const restored = this._requests$.value.slice();
      restored.splice(index, 0, row);
      this._requests$.next(sortInbox(restored));
      throw e;
    }
  }

  /**
   * Revoke an active lease and move it to the past bucket in history
   * by flipping its status to "revoked" optimistically.
   */
  async revokeLease(leaseId: string): Promise<void> {
    await this.pamApiService.revokeLease(leaseId, new LeaseRevokeRequest({}));
    // Set requestedNotAfter to epoch so groupHistory() unconditionally
    // places the row in the Past bucket regardless of when renderedAt was snapped.
    const epoch = new Date(0).toISOString();
    const updated = this._history$.value.map((item) => {
      if (item.leaseId === leaseId) {
        item.requestedNotAfter = epoch;
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
  T extends Pick<InboxAccessRequestResponse, "submittedAt" | "collectionName">,
>(rows: readonly T[]): T[] {
  return rows.slice().sort((a, b) => {
    const submittedDelta = Date.parse(a.submittedAt) - Date.parse(b.submittedAt);
    if (submittedDelta !== 0) {
      return submittedDelta;
    }
    return a.collectionName.localeCompare(b.collectionName, undefined, { sensitivity: "base" });
  });
}
