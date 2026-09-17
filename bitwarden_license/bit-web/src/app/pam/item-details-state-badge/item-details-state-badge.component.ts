import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { isGovernedCipher } from "../helpers/governed-cipher";
import { liveActiveLease } from "../helpers/lease-liveness";
import { CipherAccessStateService } from "../services/cipher-access-state.service";

/**
 * Binds `ITEM_DETAILS_STATE_BADGE` for the open item: the access-state pill on the
 * item-details card's name row, via the shared {@link AccessStateBadgeComponent}.
 *
 * Separate from `VaultRowLeaseBadgeComponent` since refresh semantics differ: this reads through
 * {@link CipherAccessStateService} so a card mutation can't leave a contradicting pill, while a
 * vault list reads once per row instead.
 *
 * {@link isGovernedCipher} keeps a plain item from firing a PAM read; a null state renders no
 * element, not even the spacing wrapper.
 *
 * An ACTIVE lease shows no pill here, since the banner heading below already runs its own
 * countdown and two independent timers would drift visibly. The pill comes BACK when that lease
 * runs out — {@link CipherAccessStateService} re-emits at its `notAfter`.
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
  private readonly cipherAccessStateService = inject(CipherAccessStateService);

  private readonly state$: Observable<AccessBadgeState | null> = combineLatest([
    toObservable(this.cipher),
    this.configService.getFeatureFlag$(FeatureFlag.Pam),
  ]).pipe(
    switchMap(([cipher, enabled]) => {
      if (!enabled || cipher == null || cipher.id == null || !isGovernedCipher(cipher)) {
        return of(null);
      }
      return this.cipherAccessStateService.state$(String(cipher.id)).pipe(
        // Suppressed on a LIVE lease rather than on the SDK's `active` ranking. The two part ways
        // exactly when the lease has lapsed but the re-read still carries it — a server whose
        // clock trails this one — and suppressing on the ranking there would hide the pill for
        // good while the banner below had already fallen back to "Request access". Letting the
        // lapsed `active` badge through instead lands it on `AccessStateBadgeComponent`'s own
        // `remainingMs <= 0` fallback, which renders the resting "Access ended" recipe.
        map((state) => (liveActiveLease(state, Date.now()) != null ? null : state)),
        map(cipherAccessBadgeState),
      );
    }),
  );

  protected readonly badge = toSignal(this.state$, { initialValue: null });
}
