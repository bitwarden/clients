import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, from, map, merge, Observable, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AccessRefreshService } from "../abstractions/access-refresh.service";
import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";
import { isGovernedCipher } from "../helpers/governed-cipher";

/**
 * Binds `ITEM_DETAILS_STATE_BADGE` for the open item — the access-state pill on the item-details
 * card's name row. Encapsulates every PAM dependency so `libs/vault` stays PAM-free: pass the open
 * `cipher`, get the shared badge (or nothing) back. The recipe, copy and countdown live in
 * {@link AccessStateBadgeComponent}, so this reads the same as the vault row and the Requests page.
 *
 * Separate from `VaultRowLeaseBadgeComponent` because the refresh semantics differ, not because the
 * pill does. This one re-reads on {@link AccessRefreshService}, the same signal the cipher-view
 * banner and the gated-cipher reloader use, so withdrawing a request or starting a lease from the
 * card below cannot leave a contradicting pill above it. A vault list would pay that subscription
 * once per gated row for a state nobody is acting on, which is why the row host reads once instead.
 *
 * The item-details card renders for EVERY vault item, so an ungoverned cipher must cost nothing:
 * {@link isGovernedCipher} keeps a plain item from firing a PAM read, and a null state renders no
 * element.
 */
@Component({
  selector: "app-pam-item-details-state-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccessStateBadgeComponent],
  templateUrl: "./item-details-state-badge.component.html",
})
export class ItemDetailsStateBadgeComponent {
  readonly cipher = input<CipherView | null>(null);

  private readonly configService = inject(ConfigService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly accessRefreshService = inject(AccessRefreshService);
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
            map(cipherAccessBadgeState),
            catchError((e: unknown) => {
              // An unreadable access state renders no pill rather than an error — the item itself is
              // still useful, and the banner below behaves the same way.
              this.logService.error(e);
              return of(null);
            }),
          ),
        ),
      );
    }),
  );

  protected readonly badge = toSignal(this.state$, { initialValue: null });
}
