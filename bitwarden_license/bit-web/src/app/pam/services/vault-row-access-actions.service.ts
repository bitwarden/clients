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
 * {@link cancelableRequest$} is memoized per cipher id, since the row menu reads it through `async`
 * on every change-detection pass. Its read is lazy and released when the menu closes.
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

  /** Only a gated row can carry an access request. */
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
          // An unreadable state offers no menu entry rather than an error, like the vault-row
          // badge.
          catchError(() => of(false)),
        );
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
  }
}
