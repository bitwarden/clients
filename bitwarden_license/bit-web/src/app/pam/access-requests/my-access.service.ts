import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  from,
  map,
  merge,
  switchMap,
  take,
} from "rxjs";

import {
  AccessEventService,
  AccessLeaseId,
  AccessLeaseSdkService,
  AccessLeaseView,
  AccessRefreshService,
  AccessRequestId,
  AccessRequestSdkService,
  AccessRequestView,
  isLeaseLive,
} from "@bitwarden/bit-pam";
import { AccessBadgeTickerService } from "@bitwarden/bit-pam-components";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

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
  lapsedInHistory,
  resolvedOrSubmittedMs,
  toLeaseRow,
  toRequestRow,
} from "./my-access-row";

/**
 * Data service for the caller's own requests and leases, provided on the shell route so the tabs
 * share one load. Each landed mutation announces on {@link AccessRefreshService}, so the root nav
 * badge re-reads without waiting for the push.
 */
@Injectable()
export class MyAccessService {
  private readonly requestsApi = inject(AccessRequestSdkService);
  private readonly leasesApi = inject(AccessLeaseSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly accessEvents = inject(AccessEventService);
  private readonly accessRefresh = inject(AccessRefreshService);
  private readonly accountService = inject(AccountService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ticker = inject(AccessBadgeTickerService);

  private readonly _requests$ = new BehaviorSubject<AccessRequestView[]>([]);
  private readonly _leases$ = new BehaviorSubject<AccessLeaseView[]>([]);
  private readonly _names$ = new BehaviorSubject<ResolvedNames>(emptyResolvedNames());
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);

  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();

  private readonly rows$: Observable<MyAccessRequestRow[]> = combineLatest([
    this._requests$,
    this._names$,
  ]).pipe(map(([requests, names]) => buildMyAccessRequestRows(requests, names)));

  /** The caller's active leases, badged with any applied extension. */
  readonly leases$: Observable<MyAccessLeaseRow[]> = combineLatest([
    this._leases$,
    this._requests$,
    this._names$,
  ]).pipe(
    map(([leases, requests, names]) => {
      const extByLease = extensionsByLeaseId(requests);
      const nowMs = Date.now();
      return leases
        .filter((l) => l.status === "active" && isLeaseLive(l, nowMs))
        .map((l) => toLeaseRow(l, names, extByLease.get(uuidAsString(l.id))));
    }),
  );

  /**
   * Requests the requester can still act on: pending, or a grant that can still be activated.
   * Pending extensions are listed in {@link extensionRows$} instead.
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
   * Pending extension requests, read from the raw requests since {@link rows$} folds extensions
   * onto their grant. An applied one becomes its grant's "Extended" badge; a denied one moves to
   * History.
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
   * Terminal requests, newest first. A grant with an active lease joins once the lease ends, and
   * anything whose access is already over gets {@link lapsedGrantBadge}, see
   * {@link lapsedInHistory}.
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
        .map((r) => (lapsedInHistory(r) ? { ...r, statusBadge: lapsedGrantBadge } : r))
        .sort((a, b) => resolvedOrSubmittedMs(b) - resolvedOrSubmittedMs(a))
        .slice(0, MY_ACCESS_PAGE_LIMIT);
    }),
  );

  /**
   * Decrypted gated ciphers by id, for favicons. A cipher absent from the caller's vault is
   * missing, so its row renders without one.
   */
  readonly cipherById$: Observable<Map<string, CipherView>> = this._names$.pipe(
    map((names) => names.cipherById),
  );

  constructor() {
    // A window closing and a push arriving are both reasons to re-read, so they share one
    // stream: `concatMap` only serialises within a stream, and two of them could overlap and
    // land out of order, leaving the subjects showing the older read.
    const lapsed$ = combineLatest([this._leases$, this._requests$]).pipe(
      map(([leases, requests]) => nextLapseMs(leases, requests)),
      distinctUntilChanged(),
      switchMap((endMs) => (endMs == null ? EMPTY : this.lapseAt(endMs))),
    );

    merge(this.accessEvents.accessChanged$(), lapsed$)
      .pipe(
        concatMap(() => from(this.load())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Waits on the badges' shared clock rather than a timer: `setTimeout` fires immediately for a
   * delay past 2^31-1 ms (~24.8 days), so a distant end would reload in a loop.
   */
  private lapseAt(endMs: number): Observable<number> {
    return this.ticker.ticks$.pipe(
      filter((nowMs) => nowMs >= endMs),
      take(1),
    );
  }

  async load(): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const [requests, leases, account] = await Promise.all([
        this.requestsApi.listMyAccessRequests(),
        this.leasesApi.listMyLeases(),
        firstValueFrom(this.accountService.activeAccount$),
      ]);
      const names = await this.nameResolver.resolveNames(refsFor(requests, leases));
      this._requests$.next(requests.map((request) => withRequester(request, account)));
      this._leases$.next(leases);
      this._names$.next(names);
    } catch (e) {
      this._loadError$.next(e);
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Cancels a pending or unactivated approved request. Marks it `canceled` optimistically and
   * restores it on failure.
   */
  async cancel(id: AccessRequestId): Promise<void> {
    const current = this._requests$.value;
    const index = current.findIndex((r) => uuidAsString(r.id) === uuidAsString(id));
    if (index === -1) {
      await this.requestsApi.cancelAccessRequest(id);
      this.accessRefresh.notifyAccessChanged();
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
    this.accessRefresh.notifyAccessChanged();
  }

  /**
   * Ends the caller's own lease early. Optimistically drops it and marks the producing request's
   * lease `canceled` so History shows it at once; restores both on failure.
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
    this.accessRefresh.notifyAccessChanged();
  }

  /**
   * Activates an approved request, minting its lease. Reloads rather than patching, since the new
   * lease and `producedLeaseId` come from the server.
   */
  async activate(id: AccessRequestId): Promise<void> {
    await this.requestsApi.activateAccessRequest(id);
    this.accessRefresh.notifyAccessChanged();
    await this.load();
  }
}

/**
 * The server leaves the requester's name and email off this read, since every request on it is the
 * caller's own, so they are filled in from the active account.
 */
function withRequester(request: AccessRequestView, account: Account | null): AccessRequestView {
  if (account == null || request.requesterName || request.requesterEmail) {
    return request;
  }
  return { ...request, requesterName: account.name, requesterEmail: account.email };
}

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

/**
 * When the soonest window closes, across both things that can close one: a running lease, and an
 * approved grant nobody started. The grants matter as much as the leases, the server refuses to
 * activate past `leaseNotAfter`, so a lapsed grant has to leave Pending for History, and nothing
 * announces that either.
 */
function nextLapseMs(leases: AccessLeaseView[], requests: AccessRequestView[]): number | null {
  const nowMs = Date.now();
  const ends = [
    ...leases.filter((l) => l.status === "active").map((l) => Date.parse(l.notAfter)),
    ...requests
      .filter((r) => r.status === "approved" && r.producedLeaseId == null)
      .map((r) => Date.parse(r.leaseNotAfter)),
  ].filter((ms) => Number.isFinite(ms) && ms > nowMs);
  return ends.length === 0 ? null : Math.min(...ends);
}
