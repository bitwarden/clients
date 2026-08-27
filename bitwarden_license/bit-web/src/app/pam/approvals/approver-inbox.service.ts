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
  AccessRequestId,
  AccessRequestSdkService,
  AccessRequestView,
  ApprovalSdkService,
  canApprove,
} from "..";
import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "../access-requests/access-name-resolver.service";
import {
  MyAccessRequestRow,
  extensionsByLeaseId,
  toRequestRow,
} from "../access-requests/my-access-row";

import { ApprovalRow, sortApprovalRows, toApprovalRow } from "./approval-row";
import { isActionableInboxRequest } from "./inbox-request-filter";
import { ManagedLeaseRow, isLiveManagedLease, toManagedLeaseRow } from "./managed-lease-row";

/**
 * Page-level data service for the approver surfaces: the pending inbox and the decided history for
 * the collections the caller manages, plus the approver-side mutations (decide, revoke a lease,
 * cancel an approval).
 *
 * Every read and mutation here goes through {@link ApprovalSdkService} and the SDK's other PAM
 * clients — nothing over raw HTTP.
 *
 * Provided on the Access requests shell route so the Approvals and History tabs share one instance
 * and one pair of reads. Reloads on every server-pushed access event, so a decision made by a second
 * approver removes the row here too.
 *
 * View concerns — toasts, dialogs, filters, the clock — stay in the tab components.
 */
@Injectable()
export class ApproverInboxService {
  private readonly approvalApi = inject(ApprovalSdkService);
  private readonly requestsApi = inject(AccessRequestSdkService);
  private readonly leasesApi = inject(AccessLeaseSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly accountService = inject(AccountService);
  private readonly accessEvents = inject(AccessEventService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _inbox$ = new BehaviorSubject<AccessRequestView[]>([]);
  private readonly _history$ = new BehaviorSubject<AccessRequestView[]>([]);
  private readonly _names$ = new BehaviorSubject<ResolvedNames>(emptyResolvedNames());
  private readonly _userId$ = new BehaviorSubject<string | null>(null);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);
  /**
   * One clock shared by every row, stamped when the load landed. Rows that each called `new Date()`
   * could disagree about which requests have lapsed within the same render.
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

  /** How many requests await the caller's decision — the count the tab badges. */
  readonly pendingCount$: Observable<number> = this.inboxRows$.pipe(map((rows) => rows.length));

  /**
   * The decided requests for the collections the caller manages, newest first, as the same row model
   * the requester's own history uses.
   */
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
   * The leases that are live RIGHT NOW on the collections the caller manages, soonest to end first —
   * the access an operator can still cut off.
   *
   * A filter over the history read rather than a governance read of its own: `listHistory()` already
   * returns every managed non-pending request with its produced lease's id and status, and the SDK
   * omits a list-active-leases call on purpose.
   *
   * The window is tested as well as the status, and only once the row's effective end is known: the
   * server never transitions a lease out of `active` when its window closes, so status alone would
   * keep listing — and offering Revoke on — access that ended on its own, while testing the
   * request's own end first would drop a lease an extension has carried past it.
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

  /**
   * The ids the caller manages, so the history table knows which rows it may act on. The
   * requester's own resolved requests are merged into the same table but expose no actions.
   */
  readonly managedIds$: Observable<Set<string>> = this._history$.pipe(
    map((requests) => new Set(requests.map((request) => uuidAsString(request.id)))),
  );

  /** Decrypted gated ciphers keyed by id, for row favicons. */
  readonly cipherById$: Observable<Map<string, CipherView>> = this._names$.pipe(
    map((names) => names.cipherById),
  );

  constructor() {
    // Both halves of the server's access push: `accessChanged$` covers the caller's own requests,
    // `approverInboxChanged$` covers requests against the collections they manage — which is most
    // of what this surface renders, since an approver is rarely the requester.
    //
    // concatMap so two pushes arriving together cannot interleave their loads and leave the inbox
    // and history describing different moments.
    merge(this.accessEvents.accessChanged$(), this.accessEvents.approverInboxChanged$())
      .pipe(
        concatMap(() => from(this.load())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /** Fetch the inbox and the history, resolve display names, and replace local state. */
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
   * Record an approve or deny. Removes the row from the inbox first so a slow server cannot leave a
   * decided request sitting there invitingly; on failure it goes back where it was and the error is
   * rethrown for the caller to toast.
   *
   * On success the decided request moves to history carrying the fields it already had — the decision
   * response only populates `status`, `resolvedAt`, and the decision just recorded, so replacing the
   * row wholesale would blank the requester's resolved name and the produced lease.
   */
  async decide(
    id: AccessRequestId,
    verdict: AccessDecisionVerdict,
    comment: string | undefined,
  ): Promise<void> {
    const current = this._inbox$.value;
    const index = current.findIndex((request) => uuidAsString(request.id) === uuidAsString(id));
    if (index === -1) {
      // Already gone (a double click, or a second approver got there first). Still call through, so
      // one click is always one request and the server stays the arbiter.
      await this.approvalApi.decide(id, { verdict, comment });
      return;
    }

    const row = current[index];
    this._inbox$.next(current.filter((_, i) => i !== index));
    try {
      const resolved = await this.approvalApi.decide(id, { verdict, comment });
      this._history$.next([
        {
          ...row,
          status: resolved.status,
          resolvedAt: resolved.resolvedAt,
          decisions: resolved.decisions,
        },
        ...this._history$.value,
      ]);
    } catch (e) {
      this._inbox$.next(current);
      throw e;
    }
  }

  /**
   * End someone else's active lease early. Served by the SDK (`leases().end()`).
   *
   * Optimistically marks the produced lease `revoked` so the row re-buckets and the Revoke button
   * disappears; restores it and rethrows on failure.
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
  }

  /**
   * Withdraw an approval the requester has not yet started. Served by the SDK
   * (`access_requests().cancel()`), the same call the requester's own cancel makes; the server
   * records it as the approver's decision.
   */
  async cancelApproval(requestId: AccessRequestId): Promise<void> {
    const current = this._history$.value;
    this._history$.next(patchRequest(current, requestId, { status: "denied" }));
    try {
      await this.requestsApi.cancelAccessRequest(requestId);
    } catch (e) {
      this._history$.next(current);
      throw e;
    }
  }
}

/** No self-approval; a request with no resolved viewer is never decidable either. */
function canDecide(request: AccessRequestView, userId: string | null): boolean {
  if (userId == null) {
    return false;
  }
  return canApprove({ requesterId: uuidAsString(request.requesterId) }, { id: userId });
}

/** Replace one request in a list with an immutable copy carrying `patch`. */
function patchRequest(
  requests: AccessRequestView[],
  id: AccessRequestId,
  patch: Partial<AccessRequestView>,
): AccessRequestView[] {
  return requests.map((request) =>
    uuidAsString(request.id) === uuidAsString(id) ? { ...request, ...patch } : request,
  );
}

/** Sort key for history: when it was resolved, falling back to when it was submitted. */
function resolvedOrSubmittedMs(
  row: Pick<MyAccessRequestRow, "resolvedAt" | "submittedAt">,
): number {
  return Date.parse(row.resolvedAt ?? row.submittedAt);
}

/** The distinct cipher/collection refs across a set of requests, for name resolution. */
function refsFor(requests: AccessRequestView[]): Array<{ cipherId: string; collectionId: string }> {
  return requests.map((request) => ({
    cipherId: uuidAsString(request.cipherId),
    collectionId: uuidAsString(request.collectionId),
  }));
}
