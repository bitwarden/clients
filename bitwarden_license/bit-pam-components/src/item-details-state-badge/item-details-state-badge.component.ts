import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, concat, from, merge, Observable, of, switchMap } from "rxjs";

import {
  AccessRefreshService,
  AccessRequestSdkService,
  AccessBadgeState,
  cipherAccessBadgeState,
  isGovernedCipher,
  lapse$,
  liveActiveLease,
} from "@bitwarden/bit-pam";
import type { CipherAccessStateView } from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherId } from "@bitwarden/common/types/guid";
import { RevealedCipherService } from "@bitwarden/common/vault/abstractions/revealed-cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessBadgeTickerService } from "../access-state-badge/access-badge-ticker.service";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";

/**
 * Binds `ITEM_DETAILS_BADGE`, the access-state pill on the open item's name row. A live
 * lease shows no pill, since the banner heading below runs its own countdown and two timers would
 * drift visibly.
 */
@Component({
  selector: "app-pam-item-details-state-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccessStateBadgeComponent],
  host: { class: "tw-shrink-0" },
  templateUrl: "./item-details-state-badge.component.html",
})
export class ItemDetailsStateBadgeComponent {
  readonly cipher = input.required<CipherView>();
  /** Set by the item details when the item is open in the Admin Console. Not read yet. */
  readonly isAdminConsole = input(false);

  private readonly configService = inject(ConfigService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
  private readonly ticker = inject(AccessBadgeTickerService);
  private readonly logService = inject(LogService);
  private readonly accountService = inject(AccountService);
  private readonly revealedCipherService = inject(RevealedCipherService);

  private readonly state$: Observable<AccessBadgeState | null> = combineLatest([
    toObservable(this.cipher),
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
    this.accountService.activeAccount$.pipe(
      getUserId,
      switchMap((userId) => this.revealedCipherService.revealed$(userId)),
    ),
  ]).pipe(
    switchMap(([cipher, enabled, revealed]) => {
      if (
        !enabled ||
        cipher.id == null ||
        !isGovernedCipher(cipher, revealed.has(cipher.id as CipherId))
      ) {
        return of(null);
      }
      const cipherId = String(cipher.id);
      const read$ = () =>
        from(this.accessRequestSdkService.getCipherAccessState(cipherId)).pipe(
          catchError((e: unknown) => {
            // No pill rather than an error, since the item is still usable; the banner below
            // does the same.
            this.logService.error(e);
            return of(null);
          }),
        );
      return merge(of(undefined), this.accessRefreshService.accessChanged$(cipherId)).pipe(
        switchMap(read$),
        switchMap((state) => this.badgeWhileLeaseRuns$(state, read$)),
      );
    }),
  );

  /**
   * `state`'s badge, withheld while the lease is live on this clock. Keying on the SDK's `active`
   * ranking instead would hide the pill for good when the server's clock trails. It re-reads
   * whenever the state lapses; only the held lease itself ending, with no live lease in the fresh
   * state, lands on "Session ended". A read that fails comes back as `null`, which says nothing
   * about what was held, so the held state carries on being watched: `nextRereadMs` asks again
   * within its grace period and otherwise falls back to the lease's own end.
   */
  private badgeWhileLeaseRuns$(
    state: CipherAccessStateView | null,
    read$: () => Observable<CipherAccessStateView | null>,
  ): Observable<AccessBadgeState | null> {
    const badge = cipherAccessBadgeState(state);
    const lease = liveActiveLease(state, Date.now());
    return concat(
      of(lease == null ? badge : null),
      lapse$(state, this.ticker.ticks$).pipe(
        switchMap(read$),
        switchMap((fresh) =>
          lease != null &&
          liveActiveLease(state, Date.now()) == null &&
          liveActiveLease(fresh, Date.now()) == null
            ? of(badge)
            : this.badgeWhileLeaseRuns$(fresh ?? state, read$),
        ),
      ),
    );
  }

  protected readonly badge = toSignal(this.state$, { initialValue: null });
}
