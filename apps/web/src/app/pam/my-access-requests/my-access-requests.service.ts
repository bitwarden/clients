import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, distinctUntilChanged, map } from "rxjs";

import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
} from "@bitwarden/pam";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import { LeaseRow, MyRequestRow, toLeaseRow, toRow } from "./my-request-row";

/**
 * Loads and holds the caller's own access requests and active leases, resolving display
 * names from local vault state and managing optimistic cancel / activate.
 *
 * Page-scoped (one instance per approver-inbox page) so the page can read counts and the
 * full history for the audit log, while the "My requests" tab renders the same state — one
 * load, one source of truth. No name decryption happens here; the resolver reads already-
 * decrypted names from vault state. No other Vault Data passes through this service.
 */
@Injectable()
export class MyAccessRequestsService {
  private readonly pamApi = inject(PamApiService);
  private readonly nameResolver = inject(AccessRequestNameResolver);

  private readonly _responses$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  private readonly _leases$ = new BehaviorSubject<LeaseRow[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);

  /** Raw responses with names resolved — the audit log needs the response shape for bucketing. */
  readonly responses$: Observable<AccessRequestDetailsResponse[]> = this._responses$.asObservable();
  readonly rows$: Observable<MyRequestRow[]> = this._responses$.pipe(
    map((responses) => responses.map((r) => toRow(r))),
  );
  readonly leases$: Observable<LeaseRow[]> = this._leases$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly pendingCount$: Observable<number> = this._responses$.pipe(
    map((responses) => responses.filter((r) => r.status === AccessRequestStatus.Pending).length),
    distinctUntilChanged(),
  );

  /** Fetch the caller's requests + active leases, resolve display names, replace local state. */
  async load(): Promise<void> {
    this._loading$.next(true);
    try {
      const [requests, leases] = await Promise.all([
        this.pamApi.listMyAccessRequests(),
        this.pamApi.listActiveLeases(),
      ]);
      // Resolve request names in place; resolve lease names into lookup maps (leases have no
      // writable name fields). One vault + collection snapshot covers both.
      await this.nameResolver.resolveDisplayNames(requests);
      const leaseNames = await this.nameResolver.namesFor(leases);
      this._responses$.next(requests);
      this._leases$.next(leases.map((lease) => toLeaseRow(lease, leaseNames)));
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Cancel a pending (or approved-but-unactivated) request. Flips the row to "cancelled"
   * optimistically, then calls the API; on failure restores the row's prior fields and rethrows
   * so the caller can toast.
   */
  async cancel(id: string): Promise<void> {
    const current = this._responses$.value;
    const target = current.find((r) => r.id === id);
    if (target == null) {
      await this.pamApi.cancelAccessRequest(id);
      return;
    }
    const snapshot = {
      status: target.status,
      resolvedAt: target.resolvedAt,
      approverId: target.approverId,
    };
    target.status = AccessRequestStatus.Cancelled;
    target.resolvedAt = new Date().toISOString();
    target.approverId = null;
    this._responses$.next([...current]);
    try {
      await this.pamApi.cancelAccessRequest(id);
    } catch (e) {
      Object.assign(target, snapshot);
      this._responses$.next([...current]);
      throw e;
    }
  }

  /**
   * Activate an approved request (mints the lease). Reloads on success so the new lease and
   * the request's "activated" status surface; rethrows on failure for the caller to toast.
   */
  async activate(id: string): Promise<AccessLeaseResponse> {
    const lease = await this.pamApi.activateLease(id);
    await this.load();
    return lease;
  }
}
