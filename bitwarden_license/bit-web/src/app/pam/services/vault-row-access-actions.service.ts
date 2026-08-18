import {
  catchError,
  combineLatest,
  from,
  map,
  merge,
  Observable,
  of,
  shareReplay,
  switchMap,
} from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { VaultRowAccessActionsService } from "@bitwarden/web-vault/app/vault/components/vault-items/vault-row-access-actions.service";

import { AccessRefreshService, AccessRequestSdkService } from "..";

import { AccessRequestCancelService } from "./access-request-cancel.service";

/** The one stream every ineligible cipher shares, so template reads stay referentially stable. */
const NEVER_CANCELABLE$ = of(false);

/**
 * PAM's {@link VaultRowAccessActionsService}: lets the vault-row menu withdraw the caller's
 * outstanding access request for a gated cipher without the row knowing anything about leasing.
 * The row calls both methods straight from its template, so the partial gate and id handling are
 * owned here, and the cancel itself (with its outcome toasts and refresh announcement) is the
 * shared {@link AccessRequestCancelService} flow — the same one the cipher-view banner runs.
 *
 * {@link cancelableRequest$} is memoized per cipher id and MUST stay that way: the row menu reads
 * it through an `async` pipe on every change-detection pass, and a fresh stream per call would
 * resubscribe (and re-fetch) each pass. The menu's content only instantiates when opened, so the
 * underlying `cipher_access_state()` read is lazy — one per open (`shareReplay` with `refCount`
 * releases the upstream when the menu closes, so the next open re-reads), re-driven by the shared
 * refresh signal while it stays open. The cache holds only cold, unsubscribed streams for rows no
 * longer rendered, so it is not emptied. "Cancelable" mirrors the banner's withdraw semantics: a
 * pending request or an approved-but-unactivated one, either of which can be withdrawn until a
 * lease is minted.
 */
export class DefaultVaultRowAccessActionsService implements VaultRowAccessActionsService {
  private readonly cancelableByCipherId = new Map<string, Observable<boolean>>();

  constructor(
    private readonly accessRequestSdkService: AccessRequestSdkService,
    private readonly accessRefreshService: AccessRefreshService,
    private readonly accessRequestCancelService: AccessRequestCancelService,
    private readonly configService: ConfigService,
  ) {}

  cancelableRequest$(cipher: CipherViewLike): Observable<boolean> {
    const cipherId = this.gatedCipherId(cipher);
    if (cipherId == null) {
      return NEVER_CANCELABLE$;
    }
    let state$ = this.cancelableByCipherId.get(cipherId);
    if (state$ == null) {
      state$ = this.buildCancelableRequest$(cipherId);
      this.cancelableByCipherId.set(cipherId, state$);
    }
    return state$;
  }

  async cancelRequest(cipher: CipherViewLike): Promise<void> {
    const cipherId = this.gatedCipherId(cipher);
    if (cipherId == null) {
      return;
    }
    await this.accessRequestCancelService.cancelOutstandingRequest(cipherId);
  }

  /** The cipher's id when it is PAM-gated — only such a row can carry an access request. */
  private gatedCipherId(cipher: CipherViewLike): string | null {
    return CipherViewLikeUtils.isPartial(cipher) && cipher.id != null ? String(cipher.id) : null;
  }

  private buildCancelableRequest$(cipherId: string): Observable<boolean> {
    return combineLatest([
      this.configService.getFeatureFlag$(FeatureFlag.Pam),
      merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)),
    ]).pipe(
      switchMap(([enabled]) => {
        if (!enabled) {
          return of(false);
        }
        return from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
          map((state) => state.pendingRequest != null || state.approvedRequest != null),
          // A row whose state cannot be read offers no menu entry rather than an error — the
          // vault-row badge behaves the same way.
          catchError(() => of(false)),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
