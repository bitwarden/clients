import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, from, map, Observable, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  CipherViewLike,
  CipherViewLikeUtils,
} from "@bitwarden/common/vault/utils/cipher-view-like-utils";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { AccessBadgeState, cipherAccessBadgeState } from "../access-state-badge/access-badge-state";
import { AccessStateBadgeComponent } from "../access-state-badge/access-state-badge.component";

/**
 * Binds `VAULT_ROW_LEASE_BADGE` for one row in the vault list. Encapsulates every PAM dependency
 * so the row component stays PAM-free: pass the row's cipher, get the shared access-state badge
 * (or nothing) back. The badge recipe, copy, and countdown live in {@link AccessStateBadgeComponent}
 * so this row renders exactly what the modal and Requests page do.
 *
 * Fetches the cipher's access state once per cipher/flag change (not on an interval — a vault list
 * can render many gated rows at once, and the reveal-in-place behavior that needs live polling lives
 * in the cipher-view banner / gated-cipher reloader, not here). The active-lease countdown ticks
 * locally inside the shared badge once fetched.
 */
@Component({
  selector: "app-pam-vault-row-lease-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AccessStateBadgeComponent],
  templateUrl: "./vault-row-lease-badge.component.html",
})
export class VaultRowLeaseBadgeComponent {
  readonly cipher = input.required<CipherViewLike>();

  private readonly configService = inject(ConfigService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);

  private readonly cipher$ = toObservable(this.cipher);
  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  private readonly state$: Observable<AccessBadgeState | null> = combineLatest([
    this.cipher$,
    this.enabled$,
  ]).pipe(
    switchMap(([cipher, enabled]) => {
      // Gating is driven by the SDK's `partial` flag, which only some `CipherViewLike` members
      // carry — read it through the util rather than off the union. No flag, no id, or the
      // feature flag off — no badge.
      if (!enabled || !CipherViewLikeUtils.isPartial(cipher) || cipher.id == null) {
        return of(null);
      }
      return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
        map(cipherAccessBadgeState),
        catchError(() => of(null)),
      );
    }),
  );

  protected readonly badge = toSignal(this.state$, { initialValue: null });
}
