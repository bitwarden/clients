import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import {
  catchError,
  combineLatest,
  concat,
  filter,
  from,
  map,
  merge,
  Observable,
  of,
  switchMap,
  take,
} from "rxjs";

import {
  AccessBadgeState,
  AccessRefreshService,
  AccessRequestSdkService,
  CipherAccessStateView,
  cipherAccessBadgeState,
  isGovernedCipher,
  liveActiveLease,
} from "@bitwarden/bit-common/pam";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";

/**
 * Binds `ITEM_DETAILS_STATE_BADGE`: the access-state pill on the open item's name row, re-read on
 * {@link AccessRefreshService}. Renders nothing for an ungoverned cipher, and nothing while a lease
 * is live, since the cipher-view banner shows that countdown.
 */
@Component({
  selector: "app-pam-item-details-state-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccessStateBadgeComponent],
  host: { class: "tw-shrink-0" },
  templateUrl: "./item-details-state-badge.component.html",
})
export class ItemDetailsStateBadgeComponent {
  readonly cipher = input<CipherView | null>(null);

  private readonly configService = inject(ConfigService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly logService = inject(LogService);

  private readonly state$: Observable<AccessBadgeState | null> = combineLatest([
    toObservable(this.cipher),
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
  ]).pipe(
    switchMap(([cipher, enabled]) => {
      if (!enabled || cipher == null || cipher.id == null || !isGovernedCipher(cipher)) {
        return of(null);
      }
      const cipherId = String(cipher.id);
      return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
        switchMap(() =>
          from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
            catchError((e: unknown) => {
              this.logService.error(e);
              return of(null);
            }),
          ),
        ),
        switchMap((state) => this.badgeWhileLeaseRuns$(state)),
      );
    }),
  );

  /** `state`'s badge, withheld while its lease is live. */
  private badgeWhileLeaseRuns$(
    state: CipherAccessStateView | null,
  ): Observable<AccessBadgeState | null> {
    const badge = cipherAccessBadgeState(state);
    if (liveActiveLease(state, Date.now()) == null) {
      return of(badge);
    }
    return concat(
      of(null),
      this.ticker.ticks$.pipe(
        filter((nowMs) => liveActiveLease(state, nowMs) == null),
        take(1),
        map(() => badge),
      ),
    );
  }

  protected readonly badge = toSignal(this.state$, { initialValue: null });
}
