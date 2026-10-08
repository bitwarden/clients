import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  concatMap,
  firstValueFrom,
  from,
  map,
  merge,
} from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AccessDecisionVerdict,
  AccessEventService,
  AccessLeaseId,
  AccessLeaseSdkService,
  AccessRefreshService,
  AccessRequestId,
  AccessRequestSdkService,
  AccessRequestView,
  ApprovalSdkService,
  canApprove,
  isRequestNoLongerPendingError,
} from "..";
import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "../access-requests/access-name-resolver.service";
import {
  MyAccessRequestRow,
  extensionsByLeaseId,
  resolvedOrSubmittedMs,
  toRequestRow,
} from "../access-requests/my-access-row";

import { ApprovalRow, sortApprovalRows, toApprovalRow } from "./approval-row";
import { isActionableInboxRequest } from "./inbox-request-filter";
import { ManagedLeaseRow, isLiveManagedLease, toManagedLeaseRow } from "./managed-lease-row";

/**
 * Data service for the approver surfaces, provided on the shell route so the tabs share one
 * load. Each landed mutation announces on {@link AccessRefreshService}, so the root nav badge
 * re-reads without waiting for the push.
 */
@Injectable()
export class ApproverInboxService {
  private readonly approvalApi = inject(ApprovalSdkService);
  private readonly requestsApi = inject(AccessRequestSdkService);
  private readonly leasesApi = inject(AccessLeaseSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly accountService = inject(AccountService);
  private readonly accessEvents = inject(AccessEventService);
  private readonly accessRefresh = inject(AccessRefreshService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _inbox$ = new BehaviorSubject<AccessRequestView[]>([]);
  private readonly _history$ = new BehaviorSubject<AccessRequestView[]>([]);
  private readonly _names$ = new BehaviorSubject<ResolvedNames>(emptyResolvedNames());
  private readonly _userId$ = new BehaviorSubject<string | null>(null);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);
  /**
   * One clock shared by every row, stamped at load. Rows each calling `new Date()` could
   * disagree about which requests have lapsed within the same render.
   */
  private readonly _renderedAt$ = new BehaviorSubject<Date>(new Date());

  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();

  /** The requests awaiting a decision, oldest first, timed-out ones dropped. */
  readonly inboxRows$: Observable<ApprovalRow[]> = combineLatest([
    this._inbox$,
    this._names$,
    this._userId$,
    this._renderedAt$,
  ]).pipe(
    map(([requests, names, userId, now]) =>
      sortApprovalRows(
        requests
          .filter((request) => isActionableInboxRequest(request, now))
          .map((request) => toApprovalRow(request, names, now, canDecide(request, userId))),
      ),
    ),
  );

  /** How many requests await the caller's decision, for the Approvals tab badge. */
  readonly pendingCount$: Observable<number> = this.inboxRows$.pipe(map((rows) => rows.length));

  /** The decided requests on managed collections, newest first. */
  readonly historyRows$: Observable<MyAccessRequestRow[]> = combineLatest([
    this._history$,
    this._names$,
  ]).pipe(
    map(([requests, names]) =>
      requests
        .map((request) => toRequestRow(request, names))
        .sort((a, b) => resolvedOrSubmittedMs(b) - resolvedOrSubmittedMs(a)),
    ),
  );

  /**
   * The leases live right now on managed collections, soonest to end first. Tests the effective
   * end as well as the status, since a lease can lapse after the history was read.
   */
  readonly activeLeaseRows$: Observable<ManagedLeaseRow[]> = combineLatest([
    this._history$,
    this._names$,
    this._renderedAt$,
  ]).pipe(
    map(([requests, names, now]) => {
      const extensions = extensionsByLeaseId(requests);
      return requests
        .filter(isLiveManagedLease)
        .map((request) =>
          toManagedLeaseRow(request, names, extensions.get(uuidAsString(request.producedLeaseId))),
        )
        .filter((row) => row.endsAtMs > now.getTime())
        .sort((a, b) => a.endsAtMs - b.endsAtMs);
    }),
  );

  /** The request ids on managed collections, the only History rows the caller may act on. */
  readonly managedIds$: Observable<Set<string>> = this._history$.pipe(
    map((requests) => new Set(requests.map((request) => uuidAsString(request.id)))),
  );

  /** Decrypted gated ciphers keyed by id, for row favicons. */
  readonly cipherById$: Observable<Map<string, CipherView>> = this._names$.pipe(
    map((names) => names.cipherById),
  );

  constructor() {
    // `concatMap` so two pushes can't interleave their loads and leave the subjects out of step.
    merge(this.accessEvents.accessChanged$(), this.accessEvents.approverInboxChanged$())
      .pipe(
        concatMap(() => from(this.load())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  async load(): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const userId = uuidAsString(
        await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId)),
      );
      const [inbox, history] = await Promise.all([
        this.approvalApi.listInbox(),
        this.approvalApi.listHistory(),
      ]);
      const names = await this.nameResolver.resolveNames(refsFor([...inbox, ...history]));
      this._userId$.next(userId);
      this._inbox$.next(inbox);
      this._history$.next(history);
      this._names$.next(names);
      this._renderedAt$.next(new Date());
    } catch (e) {
      this._loadError$.next(e);
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * Drops the row before the call so a slow server can't leave it showing, and restores it on
   * failure. A request that already left the pending set re-reads instead, since restoring would
   * clobber any load that landed meanwhile.
   */
  async decide(
    id: AccessRequestId,
    verdict: AccessDecisionVerdict,
    comment: string | undefined,
  ): Promise<void> {
    const current = this._inbox$.value;
    // A row already gone (a double click, or another approver decided first) still sends the
    // call, so one click is always one request.
    const index = current.findIndex((request) => uuidAsString(request.id) === uuidAsString(id));
    if (index !== -1) {
      this._inbox$.next(current.filter((_, i) => i !== index));
    }
    try {
      await this.approvalApi.decide(id, { verdict, comment });
    } catch (e) {
      if (isRequestNoLongerPendingError(e)) {
        this.accessRefresh.notifyAccessChanged();
        await this.load();
      } else {
        this._inbox$.next(current);
      }
      throw e;
    }
    this.accessRefresh.notifyAccessChanged();
    await this.load();
  }

  /**
   * Ends someone else's active lease early. Marks it `revoked` optimistically so the row
   * re-buckets.
   */
  async revokeLease(requestId: AccessRequestId, leaseId: AccessLeaseId): Promise<void> {
    const current = this._history$.value;
    this._history$.next(patchRequest(current, requestId, { producedLeaseStatus: "revoked" }));
    try {
      await this.leasesApi.endLease(leaseId, { reason: undefined });
    } catch (e) {
      this._history$.next(current);
      throw e;
    }
    this.accessRefresh.notifyAccessChanged();
  }

  /**
   * Withdraws an approval the requester has not started; the server records the cancel as the
   * approver's decision. Reloads instead of patching, so the row names whoever withdrew it.
   */
  async cancelApproval(requestId: AccessRequestId): Promise<void> {
    await this.requestsApi.cancelAccessRequest(requestId);
    this.accessRefresh.notifyAccessChanged();
    await this.load();
  }
}

/** No self-approval; a request with no resolved viewer is never decidable either. */
function canDecide(request: AccessRequestView, userId: string | null): boolean {
  if (userId == null) {
    return false;
  }
  return canApprove({ requesterId: uuidAsString(request.requesterId) }, { id: userId });
}

function patchRequest(
  requests: AccessRequestView[],
  id: AccessRequestId,
  patch: Partial<AccessRequestView>,
): AccessRequestView[] {
  return requests.map((request) =>
    uuidAsString(request.id) === uuidAsString(id) ? { ...request, ...patch } : request,
  );
}

function refsFor(requests: AccessRequestView[]): Array<{ cipherId: string; collectionId: string }> {
  return requests.map((request) => ({
    cipherId: uuidAsString(request.cipherId),
    collectionId: uuidAsString(request.collectionId),
  }));
}
