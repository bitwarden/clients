import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import {
  BehaviorSubject,
  Observable,
  combineLatest,
  distinctUntilChanged,
  filter,
  map,
  startWith,
  switchMap,
} from "rxjs";

import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AccessEventService,
  AccessLeaseId,
  AccessLeaseSdkService,
  AccessRequestId,
  AccessRequestSdkService,
  AccessRequestView,
  LeasingErrorService,
} from "../..";
import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "../access-name-resolver.service";

/**
 * Loads and holds the single access request behind the `/pam/requests/:id` dialog, resolving
 * display names from local vault state and owning requester-facing mutations
 * (cancel/activate/end lease); Approve/Deny is not offered here, since a requester never decides
 * their own request.
 *
 * Scoped to the route so each visit gets its own instance, provided on the route's host component
 * since it reads `:id` off `ActivatedRoute` (a route-config provider would resolve in the
 * environment injector, which falls through to the root route).
 *
 * Re-fetches on the route id and on every server-pushed access event, so an approver's decision
 * lands without a reload; mutations here re-fetch explicitly rather than waiting on their own push.
 */
@Injectable()
export class AccessRequestDetailService {
  private readonly requestsApi = inject(AccessRequestSdkService);
  private readonly leasesApi = inject(AccessLeaseSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);
  private readonly leasingErrors = inject(LeasingErrorService);
  private readonly accessEvents = inject(AccessEventService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  private readonly _request$ = new BehaviorSubject<AccessRequestView | null>(null);
  private readonly _names$ = new BehaviorSubject<ResolvedNames>(emptyResolvedNames());
  private readonly _loading$ = new BehaviorSubject<boolean>(true);
  private readonly _loadError$ = new BehaviorSubject<unknown | null>(null);
  private readonly _notFound$ = new BehaviorSubject<boolean>(false);

  /** The loaded request; its display names come from {@link names$}. Null while loading/errored. */
  readonly request$: Observable<AccessRequestView | null> = this._request$.asObservable();
  readonly names$: Observable<ResolvedNames> = this._names$.asObservable();
  readonly loading$: Observable<boolean> = this._loading$.asObservable();
  readonly loadError$: Observable<unknown | null> = this._loadError$.asObservable();
  /** True when the request is missing or invisible to the caller — the server 404s both. */
  readonly notFound$: Observable<boolean> = this._notFound$.asObservable();
  /** Decrypted gated cipher keyed by id, for the item's favicon; blank when absent from the vault. */
  readonly cipherById$: Observable<Map<string, CipherView>> = this.names$.pipe(
    map((names) => names.cipherById),
  );

  constructor() {
    // Loads on id change and every access push; `startWith` gives the push stream an initial
    // value so combineLatest emits on first paint. fetch() records failures rather than throwing.
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
  }

  /** Cancel/withdraw the loaded request, then reload to surface the canceled status. */
  async cancel(): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    await this.requestsApi.cancelAccessRequest(id);
    await this.fetch(id);
  }

  /** Activate the loaded approved request (mints the lease), then reload to surface it. */
  async activate(): Promise<void> {
    const id = this._request$.value?.id;
    if (id == null) {
      return;
    }
    await this.requestsApi.activateAccessRequest(id);
    await this.fetch(id);
  }

  /** End the active lease this request produced, then reload to surface the ended status. */
  async endLease(leaseId: AccessLeaseId): Promise<void> {
    await this.leasesApi.endLease(leaseId, { reason: undefined });
    const id = this._request$.value?.id;
    if (id != null) {
      await this.fetch(id);
    }
  }

  /** Fetch the request by id and replace local state; display names resolve via {@link names$}. */
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
      // A 404 (missing or not visible — the server returns the same for both) is not-found, not
      // an error.
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
   * Whether a `getAccessRequest` failure means "not found".
   *
   * The SDK's `LeasingError` has no distinct not-found variant: a 404 folds into the generic
   * `"Api"` variant, whose message is the only place the status code survives. Best-effort
   * string-matching pending a structured SDK variant; a false negative just downgrades to the
   * generic error banner.
   */
  private isRequestNotFoundError(e: unknown): boolean {
    return this.leasingErrors.isLeasingError(e) && e.variant === "Api" && /\[404\]/.test(e.message);
  }
}
