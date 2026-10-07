import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
  from,
  map,
  startWith,
  switchMap,
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
  LeasingErrorService,
  canApprove,
  isRequestNoLongerPendingError,
} from "../..";
import { ApprovalRow } from "../../approvals/approval-row";
import { ApproverInboxService } from "../../approvals/approver-inbox.service";
import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "../access-name-resolver.service";

/** Who is looking at the request, since the requester and approvers open the same link. */
export type AccessRequestViewer = "requester" | "approver";

/**
 * Approver mutations go through the shell's {@link ApproverInboxService}, which keeps the tabs
 * behind the dialog in step and decides whether the viewer may act; the server returns a request
 * to anyone who can see it.
 */
@Injectable()
export class AccessRequestDetailService {
  private readonly requestsApi = inject(AccessRequestSdkService);
  private readonly leasesApi = inject(AccessLeaseSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly leasingErrors = inject(LeasingErrorService);
  private readonly accessEvents = inject(AccessEventService);
  private readonly accessRefresh = inject(AccessRefreshService);
  private readonly accountService = inject(AccountService);
  private readonly inbox = inject(ApproverInboxService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _request$ = new BehaviorSubject<AccessRequestView | null>(null);
  private readonly _names$ = new BehaviorSubject<ResolvedNames>(emptyResolvedNames());
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);
  private readonly _notFound$ = new BehaviorSubject<boolean>(false);

  /** Null before a request loads, or once it is not found. */
  readonly request$: Observable<AccessRequestView | null> = this._request$.asObservable();
  readonly names$: Observable<ResolvedNames> = this._names$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();
  /** True when the request is missing or invisible to the caller; the server 404s both. */
  readonly notFound$: Observable<boolean> = this._notFound$.asObservable();
  /** Decrypted gated cipher by id, for the favicon; empty when absent from the vault. */
  readonly cipherById$: Observable<Map<string, CipherView>> = this.names$.pipe(
    map((names) => names.cipherById),
  );

  /**
   * Null until both the request and the active user are known, so neither side's actions flash up
   * first.
   */
  readonly viewer$: Observable<AccessRequestViewer | null> = combineLatest([
    this.request$,
    this.accountService.activeAccount$.pipe(getUserId),
  ]).pipe(
    map(([request, userId]): AccessRequestViewer | null => {
      if (request == null || userId == null) {
        return null;
      }
      const approval = { requesterId: uuidAsString(request.requesterId) };
      return canApprove(approval, { id: uuidAsString(userId) }) ? "approver" : "requester";
    }),
    distinctUntilChanged(),
  );

  /**
   * The request's inbox row, or null when the viewer can't decide it: it's theirs, already decided,
   * timed out, or on a collection they don't manage.
   */
  readonly approvalRow$: Observable<ApprovalRow | null> = combineLatest([
    this.request$,
    this.inbox.inboxRows$,
  ]).pipe(
    map(([request, rows]) => {
      if (request == null) {
        return null;
      }
      const id = uuidAsString(request.id);
      return rows.find((row) => row.canDecide && uuidAsString(row.id) === id) ?? null;
    }),
  );

  /** Whether the request is on a collection the viewer manages and has already been decided. */
  readonly managed$: Observable<boolean> = combineLatest([
    this.request$,
    this.inbox.managedIds$,
  ]).pipe(
    map(([request, ids]) => request != null && ids.has(uuidAsString(request.id))),
    distinctUntilChanged(),
  );

  constructor() {
    // `startWith` lets combineLatest emit before any push; fetch() records failures rather than
    // throwing.
    const id$ = this.route.paramMap.pipe(
      map((params) => params.get("id")),
      filter((id): id is string => id != null),
      distinctUntilChanged(),
    );
    combineLatest([id$, this.accessEvents.accessChanged$().pipe(startWith(undefined))])
      .pipe(
        switchMap(([id]) => this.fetch(id as unknown as AccessRequestId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();

    // A request opened by link may postdate the inbox's last load, which would offer the approver
    // no decision.
    combineLatest([this.request$, this.viewer$])
      .pipe(
        filter(([request, viewer]) => request != null && viewer === "approver"),
        map(([request]) => uuidAsString(request!.id)),
        distinctUntilChanged(),
        concatMap(() => from(this.inbox.load())),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  async cancel(): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    await this.requestsApi.cancelAccessRequest(id);
    this.accessRefresh.notifyAccessChanged();
    await this.fetch(id);
  }

  async activate(): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    await this.requestsApi.activateAccessRequest(id);
    this.accessRefresh.notifyAccessChanged();
    await this.fetch(id);
  }

  async endLease(leaseId: AccessLeaseId): Promise<void> {
    await this.leasesApi.endLease(leaseId, { reason: undefined });
    this.accessRefresh.notifyAccessChanged();
    const id = this._request$.value?.id;
    if (id != null) {
      await this.fetch(id);
    }
  }

  /**
   * A refusal because the request already left the pending set reloads too, so the body stops
   * calling it pending. Other failures skip the reload, which would fail the same way and bury the
   * toast under a banner.
   */
  async decide(verdict: AccessDecisionVerdict, comment: string | undefined): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    try {
      await this.inbox.decide(id, verdict, comment);
    } catch (e) {
      if (isRequestNoLongerPendingError(e)) {
        await this.fetch(id);
      }
      throw e;
    }
    await this.fetch(id);
  }

  /** Withdraws an approval the requester has not started yet. */
  async withdrawApproval(): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    await this.inbox.cancelApproval(id);
    await this.fetch(id);
  }

  /** Ends someone else's active lease early. */
  async revokeLease(leaseId: AccessLeaseId): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    await this.inbox.revokeLease(id, leaseId);
    await this.fetch(id);
  }

  private async fetch(id: AccessRequestId): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    this._notFound$.next(false);
    try {
      const request = await this.requestsApi.getAccessRequest(id);
      this._request$.next(request);
      this._names$.next(
        await this.nameResolver.resolveNames([
          {
            cipherId: uuidAsString(request.cipherId),
            collectionId: uuidAsString(request.collectionId),
          },
        ]),
      );
    } catch (e) {
      // A 404 means missing or not visible, not an error.
      if (this.isRequestNotFoundError(e)) {
        this._request$.next(null);
        this._notFound$.next(true);
      } else {
        this._loadError$.next(e);
      }
    } finally {
      this._loading$.next(false);
    }
  }

  /**
   * `LeasingError` has no not-found variant, so this matches the 404 in the `Api` variant's
   * message. A false negative only downgrades to the generic error banner.
   */
  private isRequestNotFoundError(e: unknown): boolean {
    return this.leasingErrors.isLeasingError(e) && e.variant === "Api" && /\[404\]/.test(e.message);
  }
}
