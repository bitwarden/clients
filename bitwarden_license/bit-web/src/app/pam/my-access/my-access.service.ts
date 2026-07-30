import { Injectable, inject } from "@angular/core";
import { BehaviorSubject, Observable, combineLatest, map } from "rxjs";

import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AccessLeaseId,
  AccessLeaseSdkService,
  AccessLeaseView,
  AccessRequestId,
  AccessRequestSdkService,
  AccessRequestView,
} from "..";

import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "./access-name-resolver.service";
import {
  MY_ACCESS_PAGE_LIMIT,
  MyAccessLeaseRow,
  MyAccessRequestRow,
  buildMyAccessRequestRows,
  extensionsByLeaseId,
  toLeaseRow,
} from "./my-access-row";

/**
 * Page-level data service for "My access": owns the caller's own access requests and leases,
 * loads them, resolves display names, and performs the request/lease lifecycle mutations
 * (activate, cancel, end). Faithful port of the poc's `MyAccessRequestsService`, adapted to the
 * Rust-SDK-served pass-1 services (`AccessRequestSdkService`/`AccessLeaseSdkService`) in place of
 * the poc's HTTP `PamApiService`, and with no live-push refresh (deferred — see the pam
 * `CLAUDE.md`): the page loads once on open and after every mutation reconciles itself, either via
 * an optimistic local patch (cancel/endLease) or an explicit reload (activate).
 *
 * Provided at the route level so each visit gets its own instance. View concerns (toasts, confirm
 * dialogs, the live countdown clock, action gating) stay in {@link MyAccessComponent}; this
 * service just owns state and the SDK round-trips.
 */
@Injectable()
export class MyAccessService {
  private readonly requestsApi = inject(AccessRequestSdkService);
  private readonly leasesApi = inject(AccessLeaseSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);

  private readonly _requests$ = new BehaviorSubject<AccessRequestView[]>([]);
  private readonly _leases$ = new BehaviorSubject<AccessLeaseView[]>([]);
  private readonly _names$ = new BehaviorSubject<ResolvedNames>(emptyResolvedNames());
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();

  /** Every one of the caller's requests, mapped to display rows (no filtering/sorting/paging). */
  private readonly rows$: Observable<MyAccessRequestRow[]> = combineLatest([
    this._requests$,
    this._names$,
  ]).pipe(map(([requests, names]) => buildMyAccessRequestRows(requests, names)));

  /**
   * The leases the caller currently holds (`status === "active"`), badged with any extension —
   * the extension info lives on the requests, so it's joined in here.
   */
  readonly leases$: Observable<MyAccessLeaseRow[]> = combineLatest([
    this._leases$,
    this._requests$,
    this._names$,
  ]).pipe(
    map(([leases, requests, names]) => {
      const extByLease = extensionsByLeaseId(requests);
      return leases
        .filter((l) => l.status === "active")
        .map((l) => toLeaseRow(l, names, extByLease.get(uuidAsString(l.id))));
    }),
  );

  /**
   * Requests the requester can still act on: still pending a decision, or approved and awaiting
   * activation.
   */
  readonly pendingRows$: Observable<MyAccessRequestRow[]> = this.rows$.pipe(
    map((rows) =>
      rows
        .filter((r) => r.status === "pending" || r.status === "approved")
        .slice(0, MY_ACCESS_PAGE_LIMIT),
    ),
  );

  /**
   * Terminal requests (everything but pending/approved), newest first. A grant whose lease is
   * still active is excluded — it belongs in Active leases, not both places — and returns here
   * once the lease ends.
   */
  readonly historyRows$: Observable<MyAccessRequestRow[]> = combineLatest([
    this.rows$,
    this.leases$,
  ]).pipe(
    map(([rows, leases]) => {
      const activeLeaseIds = new Set(leases.map((l) => uuidAsString(l.id)));
      return rows
        .filter(
          (r) =>
            r.status !== "pending" &&
            r.status !== "approved" &&
            !(r.producedLeaseId != null && activeLeaseIds.has(r.producedLeaseId)),
        )
        .sort((a, b) => timeOf(b) - timeOf(a))
        .slice(0, MY_ACCESS_PAGE_LIMIT);
    }),
  );

  /**
   * Decrypted gated ciphers keyed by id; the template reads these to render an item's favicon.
   * Ciphers absent from the caller's vault are simply missing, so those rows render without one.
   */
  readonly cipherById$: Observable<Map<string, CipherView>> = this._names$.pipe(
    map((names) => names.cipherById),
  );

  /** Fetch the caller's requests + active leases and replace local state. */
  async load(): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const [requests, leases] = await Promise.all([
        this.requestsApi.listMyAccessRequests(),
        this.leasesApi.listMyLeases(),
      ]);
      const names = await this.nameResolver.resolveNames(refsFor(requests, leases));
      this._requests$.next(requests);
      this._leases$.next(leases);
      this._names$.next(names);
    } catch (e) {
      this._loadError$.next(e);
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Cancel a pending, or approved-but-unactivated, request. Flips the row to "canceled"
   * optimistically (an immutable copy, not the poc's in-place mutation), then calls the SDK; on
   * failure restores the prior list and rethrows so the caller can toast.
   */
  async cancel(id: AccessRequestId): Promise<void> {
    const current = this._requests$.value;
    const index = current.findIndex((r) => uuidAsString(r.id) === uuidAsString(id));
    if (index === -1) {
      await this.requestsApi.cancelAccessRequest(id);
      return;
    }
    const optimistic: AccessRequestView = {
      ...current[index],
      status: "canceled",
      resolvedAt: new Date().toISOString(),
    };
    this._requests$.next(current.map((r, i) => (i === index ? optimistic : r)));
    try {
      await this.requestsApi.cancelAccessRequest(id);
    } catch (e) {
      this._requests$.next(current);
      throw e;
    }
  }

  /**
   * End the caller's own active lease early. Optimistically drops the lease from Active leases and
   * marks its originating request's produced lease "revoked", so the grant reappears in History
   * immediately; then calls the API and, on failure, restores both and rethrows so the caller can
   * toast. Because the real `AccessLeaseStatus` has no distinct "self-ended" value, the row may
   * briefly read "Revoked" instead of "Cancelled" until the page is next reloaded and the server's
   * decision log (which does distinguish the two — see {@link historyDisplayStatus}) is available.
   */
  async endLease(leaseId: AccessLeaseId): Promise<void> {
    const currentLeases = this._leases$.value;
    const currentRequests = this._requests$.value;
    const producingIndex = currentRequests.findIndex(
      (r) => r.producedLeaseId != null && uuidAsString(r.producedLeaseId) === uuidAsString(leaseId),
    );

    this._leases$.next(currentLeases.filter((l) => uuidAsString(l.id) !== uuidAsString(leaseId)));
    if (producingIndex !== -1) {
      this._requests$.next(
        currentRequests.map((r, i) =>
          i === producingIndex ? { ...r, producedLeaseStatus: "revoked" } : r,
        ),
      );
    }
    try {
      await this.leasesApi.endLease(leaseId, { reason: undefined });
    } catch (e) {
      this._leases$.next(currentLeases);
      if (producingIndex !== -1) {
        this._requests$.next(currentRequests);
      }
      throw e;
    }
  }

  /**
   * Activate an approved request (mints the lease). Not optimistic — reloads on success so the
   * new lease and the request's "activated" status surface; rethrows on failure for the caller to
   * toast.
   */
  async activate(id: AccessRequestId): Promise<void> {
    await this.requestsApi.activateAccessRequest(id);
    await this.load();
  }
}

/** Sort key for history: resolution time, falling back to submit time. */
function timeOf(row: MyAccessRequestRow): number {
  return Date.parse(row.resolvedAt ?? row.submittedAt);
}

/** The distinct cipher/collection refs across a set of requests + leases, for name resolution. */
function refsFor(
  requests: AccessRequestView[],
  leases: AccessLeaseView[],
): Array<{ cipherId: string; collectionId: string }> {
  return [
    ...requests.map((r) => ({
      cipherId: uuidAsString(r.cipherId),
      collectionId: uuidAsString(r.collectionId),
    })),
    ...leases.map((l) => ({
      cipherId: uuidAsString(l.cipherId),
      collectionId: uuidAsString(l.collectionId),
    })),
  ];
}
