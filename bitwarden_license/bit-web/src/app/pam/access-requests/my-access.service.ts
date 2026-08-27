import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { BehaviorSubject, Observable, combineLatest, concatMap, from, map } from "rxjs";

import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AccessEventService,
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
  isRedeemableGrant,
  lapsedGrantBadge,
  resolvedOrSubmittedMs,
  toLeaseRow,
  toRequestRow,
} from "./my-access-row";

/**
 * Page-level data service for "My access": owns the caller's own access requests and leases,
 * loads them, resolves display names, and performs the request/lease lifecycle mutations
 * (activate, cancel, end) via the Rust-SDK-served services
 * (`AccessRequestSdkService`/`AccessLeaseSdkService`). The page loads on open, reloads on every
 * server-pushed access event ({@link AccessEventService}) so an approver's decision appears without a
 * refresh, and after its own mutations reconciles itself either via an optimistic local patch
 * (cancel/endLease) or an explicit reload (activate).
 *
 * Provided on the "Access requests" shell route so each visit gets one instance shared across its
 * tabs. View concerns (toasts, confirm dialogs, the live countdown clock, action gating) stay in
 * the tab components; this service just owns state and the SDK round-trips.
 */
@Injectable()
export class MyAccessService {
  private readonly requestsApi = inject(AccessRequestSdkService);
  private readonly leasesApi = inject(AccessLeaseSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly accessEvents = inject(AccessEventService);
  private readonly destroyRef = inject(DestroyRef);

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
   * Requests the requester can still act on: still pending a decision, or approved and awaiting an
   * activation that can still happen ({@link isRedeemableGrant}). A grant whose window lapsed
   * unused is not one of them — it can mint nothing and offers no action, so it settles in
   * {@link historyRows$} rather than being carried here forever. The window is read once per
   * emission; a grant that lapses while the page is open moves on the next load, and the tab's own
   * clock withholds its actions in the meantime.
   *
   * Extension requests are surfaced separately (see {@link extensionRows$}), so {@link rows$} —
   * which already folds them away — never mixes them in here.
   */
  readonly pendingRows$: Observable<MyAccessRequestRow[]> = this.rows$.pipe(
    map((rows) => {
      const nowMs = Date.now();
      return rows
        .filter((r) => r.status === "pending" || isRedeemableGrant(r, nowMs))
        .slice(0, MY_ACCESS_PAGE_LIMIT);
    }),
  );

  /**
   * Still-open extension requests (an extension is its own request pointing at a parent lease via
   * `extensionOfLeaseId`; on approval it extends that lease in place rather than minting a new
   * one). {@link rows$} folds these onto the originating grant, so they're rebuilt directly from
   * the raw requests here to list them on their own. Terminal extensions drop off this section: an
   * applied one shows as the "Extended" badge on its grant, and a denied one moves to
   * {@link historyRows$}, which is where a resolved request belongs.
   */
  readonly extensionRows$: Observable<MyAccessRequestRow[]> = combineLatest([
    this._requests$,
    this._names$,
  ]).pipe(
    map(([requests, names]) =>
      requests
        .filter((r) => r.extensionOfLeaseId != null && r.status === "pending")
        .map((r) => toRequestRow(r, names))
        .slice(0, MY_ACCESS_PAGE_LIMIT),
    ),
  );

  /**
   * Terminal requests (everything but pending, and a grant still awaiting an activation that can
   * happen), newest first — the exact complement of {@link pendingRows$}, so a request is always in
   * one of the two. A grant whose lease is still active is excluded on top of that: it belongs in
   * Active leases, not both places, and returns here once the lease ends.
   *
   * An unactivated grant can only reach here by its window lapsing, which is not a state the
   * caller-agnostic {@link historyDisplayStatus} can name, so its badge is corrected on the way in.
   *
   * Includes a denied extension, which {@link rows$} deliberately does not fold onto its grant: it
   * added nothing to the lease, so this is the only place the requester can see it (PM-42632).
   */
  readonly historyRows$: Observable<MyAccessRequestRow[]> = combineLatest([
    this.rows$,
    this.leases$,
  ]).pipe(
    map(([rows, leases]) => {
      const nowMs = Date.now();
      const activeLeaseIds = new Set(leases.map((l) => uuidAsString(l.id)));
      return rows
        .filter(
          (r) =>
            r.status !== "pending" &&
            !isRedeemableGrant(r, nowMs) &&
            !(r.producedLeaseId != null && activeLeaseIds.has(r.producedLeaseId)),
        )
        .map((r) =>
          r.status === "approved" && r.producedLeaseId == null
            ? { ...r, statusBadge: lapsedGrantBadge }
            : r,
        )
        .sort((a, b) => resolvedOrSubmittedMs(b) - resolvedOrSubmittedMs(a))
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

  constructor() {
    // Reload on every access push. `concatMap` (not `switchMap`) so two pushes arriving close
    // together cannot interleave their loads and leave the three subjects describing different
    // moments; an in-flight load always finishes before the next starts.
    this.accessEvents
      .accessChanged$()
      .pipe(
        concatMap(() => from(this.load())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

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
   * marks its originating request's produced lease `canceled` — the status the server records for a
   * self-service end, as against `revoked` for an operator ending it — so the grant reappears in
   * History labelled "Canceled" straight away; then calls the API and, on failure, restores both
   * and rethrows so the caller can toast.
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
          i === producingIndex ? { ...r, producedLeaseStatus: "canceled" } : r,
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
   * new lease and the `producedLeaseId` that marks the request activated surface; rethrows on
   * failure for the caller to toast.
   */
  async activate(id: AccessRequestId): Promise<void> {
    await this.requestsApi.activateAccessRequest(id);
    await this.load();
  }
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
