import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  EMPTY,
  Observable,
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  filter,
  from,
  map,
  merge,
  of,
  switchMap,
} from "rxjs";

import {
  AccessDecisionRequest,
  AccessDecisionVerdict,
  AccessLeaseResponse,
  AccessLeaseRevokeRequest,
  AccessRequestDetailsResponse,
  AccessRequestStatus,
  PamApiService,
  canApprove,
} from "@bitwarden/bit-pam";
import { OrganizationService } from "@bitwarden/common/admin-console/abstractions/organization/organization.service.abstraction";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { NotificationType } from "@bitwarden/common/enums/notification-type.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ServerNotificationsService } from "@bitwarden/common/platform/server-notifications";
import { SyncService } from "@bitwarden/common/platform/sync";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessRequestNameResolver } from "../access-request-name-resolver.service";
import { hasApprovalPrivileges$ } from "../approver-inbox/approval-privileges";

/**
 * Loads and holds the single access request behind the `/pam/requests/:id` page (a shareable
 * link to one request), resolving display names from local vault state and owning the inline
 * approve / deny / cancel / activate / end-lease mutations.
 *
 * Page-scoped (provided on the route component, NOT root): the approver inbox's own page-scoped
 * services aren't available here, so this talks to {@link PamApiService} directly. It fetches on the
 * route id and re-fetches on live signals (a push that one of the caller's requests/leases changed,
 * or any mutation this client makes). Name resolution reads already-decrypted names from vault state
 * — no decryption and no other Vault Data passes through here.
 */
@Injectable()
export class AccessRequestDetailService {
  private readonly pamApi = inject(PamApiService);
  private readonly nameResolver = inject(AccessRequestNameResolver);
  private readonly notificationsService = inject(ServerNotificationsService);
  private readonly accountService = inject(AccountService);
  private readonly organizationService = inject(OrganizationService);
  private readonly route = inject(ActivatedRoute);
  private readonly syncService = inject(SyncService);
  private readonly logService = inject(LogService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _request$ = new BehaviorSubject<AccessRequestDetailsResponse | null>(null);
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);
  private readonly _notFound$ = new BehaviorSubject<boolean>(false);
  private readonly _cipherById$ = new BehaviorSubject<Map<string, CipherView>>(new Map());

  /** The `:id` segment — which request to load; re-emits when the user navigates to another id. */
  private readonly requestId$: Observable<string> = this.route.paramMap.pipe(
    map((params) => params.get("id")),
    filter((id): id is string => id != null),
    distinctUntilChanged(),
  );

  /**
   * The loaded request with its collection name back-filled from local vault state as it warms (the
   * cipher name is resolved on the load path). Null while loading, not-found, or errored.
   */
  readonly request$: Observable<AccessRequestDetailsResponse | null> = this.nameResolver
    .applyCollectionNames$(
      this._request$.pipe(map((request) => (request == null ? [] : [request]))),
    )
    .pipe(map((rows) => rows[0] ?? null));

  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();
  /** True when the request is missing or not visible to the caller (the server 404s both). */
  readonly notFound$: Observable<boolean> = this._notFound$.asObservable();
  /** Decrypted gated cipher keyed by id, for rendering the item's favicon; empty when not in vault. */
  readonly cipherById$: Observable<Map<string, CipherView>> = this._cipherById$.asObservable();

  readonly currentUserId$: Observable<string | null> = this.accountService.activeAccount$.pipe(
    map((account) => account?.id ?? null),
  );

  /**
   * Whether the viewer may approve/deny this request: they hold approval privileges in some org, the
   * request is still pending, and they are not its requester (self-approval is forbidden). The server
   * is the final authority; this only gates the buttons.
   */
  readonly canApprove$: Observable<boolean> = combineLatest([
    this._request$,
    this.currentUserId$,
    hasApprovalPrivileges$(this.accountService, this.organizationService),
  ]).pipe(
    map(
      ([request, userId, privileged]) =>
        privileged &&
        userId != null &&
        request != null &&
        request.status === AccessRequestStatus.Pending &&
        canApprove({ requesterId: request.requesterId }, { id: userId }),
    ),
    distinctUntilChanged(),
  );

  constructor() {
    // Warm local vault state so a fresh deep-link can resolve cipher/collection names without the user
    // first opening the vault. Fire-and-forget; a sync failure just leaves the id fallbacks.
    void this.syncService.fullSync(false).catch((e: unknown) => this.logService.error(e));

    // Load when the id changes, and re-load on any live signal for the current id. The outer switchMap
    // drops a stale id's refreshes; the inner one cancels an in-flight fetch. fetch() records failures
    // on loadError$/notFound$ rather than throwing, so the stream never tears down.
    this.requestId$
      .pipe(
        switchMap((id) =>
          merge(of(null), this.liveRefresh$()).pipe(
            switchMap(() => from(this.fetch(id)).pipe(catchError(() => EMPTY))),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  /**
   * Approve or deny the loaded request, then re-fetch: the decision endpoint returns only a partial
   * record, so a reload repopulates the approver identity / produced lease before the view updates.
   * Rethrows on failure for the caller to toast.
   */
  async decide(verdict: AccessDecisionVerdict, comment: string | undefined): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    await this.pamApi.decideAccessRequest(id, new AccessDecisionRequest({ verdict, comment }));
    await this.fetch(id);
  }

  /** Cancel/retract the loaded request (requester withdraws, or a managing approver retracts). */
  async cancel(): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    await this.pamApi.cancelAccessRequest(id);
    await this.fetch(id);
  }

  /** Activate the loaded approved request (mints the lease), then reload to surface it. */
  async activate(): Promise<AccessLeaseResponse | null> {
    const id = this._request$.value?.id;
    if (id == null) {
      return null;
    }
    const lease = await this.pamApi.activateLease(id);
    await this.fetch(id);
    return lease;
  }

  /** End the active lease this request produced, then reload to surface the ended status. */
  async endLease(leaseId: string): Promise<void> {
    await this.pamApi.revokeAccessLease(leaseId, new AccessLeaseRevokeRequest({}));
    const id = this._request$.value?.id;
    if (id != null) {
      await this.fetch(id);
    }
  }

  /**
   * Emits whenever the loaded request may have changed: a push to this user (one of their
   * requests/leases was decided, activated, revoked, extended, or cancelled) or any mutation this
   * client makes. Debounced to coalesce bursts.
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

  /** Fetch the request by id, resolve display names, and replace local state. Never rejects. */
  private async fetch(id: string): Promise<void> {
    this._loading$.next(true);
    this._loadError$.next(null);
    try {
      const request = await this.pamApi.getAccessRequest(id);
      const names = await this.nameResolver.resolveDisplayNames([request]);
      this._request$.next(request);
      this._cipherById$.next(names.cipherById);
      this._notFound$.next(false);
    } catch (e) {
      // 404 = the request doesn't exist or isn't visible to this caller (the server returns the same
      // for both, so ids can't be probed): a not-found state, not an error banner.
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        this._request$.next(null);
        this._notFound$.next(true);
      } else {
        this._loadError$.next(e);
      }
    } finally {
      this._loading$.next(false);
    }
  }
}
