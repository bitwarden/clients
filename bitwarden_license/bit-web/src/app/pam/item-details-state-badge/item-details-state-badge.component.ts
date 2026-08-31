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

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import type { CipherAccessStateView } from "../abstractions/access-lease";
import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { isGovernedCipher } from "../helpers/governed-cipher";
import { liveActiveLease } from "../helpers/lease-liveness";

/**
 * Binds `ITEM_DETAILS_STATE_BADGE` for the open item: the access-state pill on the
 * item-details card's name row, via the shared {@link AccessStateBadgeComponent}.
 *
 * Separate from `VaultRowLeaseBadgeComponent` since refresh semantics differ: this re-reads on
 * {@link AccessRefreshService} so a card mutation can't leave a contradicting pill, while a
 * vault list reads once per row instead.
 *
 * {@link isGovernedCipher} keeps a plain item from firing a PAM read; a null state renders no
 * element, not even the spacing wrapper.
 *
 * An ACTIVE lease shows no pill here, since the banner heading below already runs its own
 * countdown and two independent timers would drift visibly. It returns when the lease runs out.
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
              // An unreadable access state renders no pill rather than an error: the item itself
              // is still useful, and the banner below behaves the same way.
              this.logService.error(e);
              return of(null);
            }),
          ),
        ),
        switchMap((state) => this.badgeWhileLeaseRuns$(state)),
      );
    }),
  );

  /**
   * `state`'s badge, withheld while its lease is live and released the moment it lapses.
   *
   * Withheld on a LIVE lease, not on the SDK's `active` ranking. The two part ways when a server
   * whose clock trails this one still reports the lease, and the ranking would then hide the pill
   * for good while the banner below had already fallen back to "Request access". The released
   * badge lands on {@link AccessStateBadgeComponent}'s `remainingMs <= 0` "Access ended" recipe.
   */
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
