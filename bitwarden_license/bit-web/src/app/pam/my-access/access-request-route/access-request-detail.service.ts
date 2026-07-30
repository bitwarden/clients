import { DestroyRef, Injectable, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute } from "@angular/router";
import { BehaviorSubject, Observable, distinctUntilChanged, filter, map, switchMap } from "rxjs";

import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import {
  AccessLeaseId,
  AccessLeaseSdkService,
  AccessRequestId,
  AccessRequestSdkService,
  AccessRequestView,
  isLeasingError,
} from "../..";
import {
  AccessNameResolverService,
  ResolvedNames,
  emptyResolvedNames,
} from "../access-name-resolver.service";

/**
 * Loads and holds the single access request behind the `/pam/requests/:id` page — a shareable
 * link to one of the caller's own requests — resolving display names from local vault state and
 * owning the requester-facing mutations (cancel / activate / end lease). Approve/Deny is not
 * offered here: a requester never decides their own request (that's the deferred approver-inbox
 * flow).
 *
 * Page-scoped (provided on the route, not root), so each visit gets its own instance. Fetches on
 * the route id; no live-push refresh (deferred — see the pam `CLAUDE.md`), so a mutation reloads
 * explicitly and the caller re-opens the page to pick up someone else's change.
 */
@Injectable()
export class AccessRequestDetailService {
  private readonly requestsApi = inject(AccessRequestSdkService);
  private readonly leasesApi = inject(AccessLeaseSdkService);
  private readonly nameResolver = inject(AccessNameResolverService);
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
  /** True when the request is missing or not visible to the caller (the server 404s both). */
  readonly notFound$: Observable<boolean> = this._notFound$.asObservable();
  /** Decrypted gated cipher keyed by id, for the item's favicon; empty when not in the vault. */
  readonly cipherById$: Observable<Map<string, CipherView>> = this.names$.pipe(
    map((names) => names.cipherById),
  );

  constructor() {
    // Load when the id changes. fetch() records failures on loadError$/notFound$ rather than
    // throwing, so the stream never tears down.
    this.route.paramMap
      .pipe(
        map((params) => params.get("id")),
        filter((id): id is string => id != null),
        distinctUntilChanged(),
        switchMap((id) => this.fetch(id as unknown as AccessRequestId)),
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
      // A 404 (the request doesn't exist, or isn't visible to this caller — the server returns
      // the same for both, so ids can't be probed) is a not-found state, not an error banner.
      if (isRequestNotFoundError(e)) {
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

/**
 * Whether a `getAccessRequest` failure means "not found".
 *
 * The SDK's `LeasingError` has no distinct not-found variant (see `bitwarden-pam`'s `error.rs`):
 * a 404 folds into the generic `"Api"` variant, whose flattened `message` is the only place the
 * status code survives ("Received error message from server: [404] ..."). This is best-effort
 * string-matching pending a structured variant from the SDK; a false negative just downgrades to
 * the generic load-error banner instead of the not-found state.
 */
function isRequestNotFoundError(e: unknown): boolean {
  return isLeasingError(e) && e.variant === "Api" && /\[404\]/.test(e.message);
}
