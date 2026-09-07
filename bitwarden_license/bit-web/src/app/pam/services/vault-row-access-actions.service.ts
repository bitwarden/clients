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
 * outstanding access request for a gated cipher, without the row knowing about leasing. The
 * cancel itself runs through the shared {@link AccessRequestCancelService} flow.
 *
 * {@link cancelableRequest$} is memoized per cipher id and MUST stay that way, since the row
 * menu reads it via `async` pipe on every change-detection pass. The underlying read is lazy,
 * one per menu open, released on close via `shareReplay`/`refCount`.
 *
 * "Cancelable" mirrors the banner's withdraw semantics: pending or approved-but-unactivated.
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
