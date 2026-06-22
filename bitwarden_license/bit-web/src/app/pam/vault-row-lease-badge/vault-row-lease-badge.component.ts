import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { GatedState, PamApiService } from "@bitwarden/bit-pam";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { CipherLeaseBadgeComponent } from "../cipher-lease-badge/cipher-lease-badge.component";

type LeaseBadgeView = { state: GatedState; expiresAt: Date | null };

/**
 * Renders the lease badge for one row in the vault list. Encapsulates every
 * PAM dependency so the row component stays PAM-free: pass the cipher, get a
 * badge (or nothing) that stays in sync with the live lease state.
 *
 * Subscribes to `PamApiService.getCipherAccessState$` so the badge reflects
 * approvals, denials, and lease expiries pushed by the API.
 */
@Component({
  selector: "app-pam-vault-row-lease-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CipherLeaseBadgeComponent],
  template: `
    @if (badge(); as b) {
      <app-pam-cipher-lease-badge [state]="b.state" [leaseExpiresAt]="b.expiresAt" />
    }
  `,
})
export class VaultRowLeaseBadgeComponent {
  readonly cipher = input.required<CipherViewLike>();

  private readonly accountService = inject(AccountService);
  private readonly configService = inject(ConfigService);
  private readonly pamApiService = inject(PamApiService);

  private readonly cipher$ = toObservable(this.cipher);
  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);
  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly view$: Observable<LeaseBadgeView | null> = combineLatest([
    this.cipher$,
    this.enabled$,
    this.userId$,
  ]).pipe(
    switchMap(([cipher, enabled, userId]) => {
      // Gating is driven by the server-supplied `partialData` blob that ships
      // with each cipher on sync. Only `CipherView` carries it — `CipherListView`
      // rows never render the badge. No blob → not gated → no badge.
      if (
        !cipher ||
        !enabled ||
        CipherViewLikeUtils.isCipherListView(cipher) ||
        cipher.partialData == null
      ) {
        return of(null);
      }
      return this.pamApiService.getCipherAccessState$(cipher.id, userId).pipe(
        map((state): LeaseBadgeView => {
          if (state.activeLease != null) {
            return {
              state: GatedState.GatedActiveLease,
              expiresAt: new Date(state.activeLease.notAfter),
            };
          }
          return { state: GatedState.GatedNoLease, expiresAt: null };
        }),
      );
    }),
  );

  protected readonly badge = toSignal(this.view$, { initialValue: null });
}
