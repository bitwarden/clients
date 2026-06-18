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

import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  AccessLeaseResponse,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
} from "@bitwarden/pam";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";

import {
  LeaseRow,
  MyRequestRow,
  buildMyRequestRows,
  extensionsByLeaseId,
  toLeaseRow,
} from "./my-request-row";

/**
 * Loads and holds the caller's own access requests and active leases, resolving display
 * names from local vault state and managing optimistic cancel / activate.
 *
 * Page-scoped (one instance per approver-inbox page). It owns its own loading: the data is
 * fetched once on construction and refreshed on live signals (a push that one of the caller's
 * requests/leases changed, or any mutation this client makes). Consumers — the embedding page
 * (for the tab count + audit log) and the "My requests" tab — only subscribe; neither triggers a
 * load, so the page and the tab share one fetch. No name decryption happens here; the resolver
 * reads already-decrypted names from vault state. No other Vault Data passes through this service.
 */
@Injectable()
export class MyAccessRequestsService {
  private readonly pamApi = inject(PamApiService);
  private readonly nameResolver = inject(AccessRequestNameResolver);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _responses$ = new BehaviorSubject<AccessRequestDetailsResponse[]>([]);
  private readonly _leases$ = new BehaviorSubject<LeaseRow[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);
  private readonly _cipherById$ = new BehaviorSubject<Map<string, CipherView>>(new Map());

  /**
   * Collection names are resolved reactively (see {@link AccessRequestNameResolver.applyCollectionNames$}):
   * they back-fill when local collection state warms up, whether that happens before or after the
   * load populates the rows. Cipher names + favicons come from the one-shot load path below.
   *
   * Raw responses (names applied) — the audit log needs the response shape for bucketing.
   */
  readonly responses$: Observable<AccessRequestDetailsResponse[]> =
    this.nameResolver.applyCollectionNames$(this._responses$);
  readonly rows$: Observable<MyRequestRow[]> = this.responses$.pipe(map(buildMyRequestRows));
  readonly leases$: Observable<LeaseRow[]> = this.nameResolver.applyCollectionNames$(this._leases$);
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();
  /**
   * Decrypted views for every gated cipher referenced by a request or lease, keyed by id.
   * The list templates read from here to render an item's favicon; ciphers absent from the
   * caller's vault are simply missing, so those rows render without an icon.
   */
  readonly cipherById$: Observable<Map<string, CipherView>> = this._cipherById$.asObservable();
  readonly pendingCount$: Observable<number> = this._responses$.pipe(
    // Extensions never get their own row (they fold into the original), so they must not be counted
    // here either — otherwise the tab badge would count a request with no visible row.
    map(
      (responses) =>
        responses.filter(
          (r) => r.status === AccessRequestStatus.Pending && r.extensionOfLeaseId == null,
        ).length,
    ),
    distinctUntilChanged(),
  );

  constructor() {
    // Fetch on construction (page open), then refresh on live signals. Swallow per-refresh failures
    // (fetch records loadError$) so one bad fetch doesn't tear down the stream.
    merge(of(null), this.liveRefresh$())
      .pipe(
        switchMap(() => from(this.fetch()).pipe(catchError(() => EMPTY))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Force an immediate re-fetch; awaited by {@link activate} and available as a reconcile hook. */
  async load(): Promise<void> {
    await this.fetch();
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
      decisions: target.decisions,
    };
    target.status = AccessRequestStatus.Cancelled;
    target.resolvedAt = new Date().toISOString();
    target.decisions = [];
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

  /**
   * Emits whenever the caller's own requests/leases may have changed: a push to this user (one of
   * their requests/leases was decided, activated, revoked, extended, or cancelled) and any mutation
   * this client makes. Debounced to coalesce bursts.
   */
  private liveRefresh$(): Observable<unknown> {
    return merge(
      this.notificationsService.notifications$.pipe(
        filter(
          ([notification]) =>
            notification.type === NotificationType.RefreshAccessRequest ||
            notification.type === NotificationType.RefreshApproverInbox,
        ),
      ),
      this.pamApi.mutations$,
    ).pipe(debounceTime(300));
  }

  /** Fetch the caller's requests + active leases, resolve display names, replace local state. */
  private async fetch(): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const [requests, leases] = await Promise.all([
        this.pamApi.listMyAccessRequests(),
        this.pamApi.listActiveLeases(),
      ]);
      // Resolve request names in place; resolve lease names into lookup maps (leases have no
      // writable name fields). Run the two snapshots concurrently so one load doesn't serialize
      // two cipher-decrypt round-trips.
      const [requestNames, leaseNames] = await Promise.all([
        this.nameResolver.resolveDisplayNames(requests),
        this.nameResolver.namesFor(leases),
      ]);
      this._responses$.next(requests);
      // Badge an active lease that has been extended; the extension info lives on the requests.
      const extByLease = extensionsByLeaseId(requests);
      this._leases$.next(
        leases.map((lease) => toLeaseRow(lease, leaseNames, extByLease.get(lease.id))),
      );
      // Merge the decrypted views from both snapshots so the list can render favicons.
      this._cipherById$.next(new Map([...requestNames.cipherById, ...leaseNames.cipherById]));
    } catch (e) {
      this._loadError$.next(e);
      throw e;
    } finally {
      this._loading$.next(false);
    }
  }
}
