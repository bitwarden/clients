import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { GatedState, PamApiService } from "@bitwarden/pam";

import { CipherLeaseBadgeComponent } from "../cipher-lease-badge/cipher-lease-badge.component";
import { PamMockConfig } from "../mock/pam-mock-config";

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
  selector: "app-vault-row-lease-badge",
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CipherLeaseBadgeComponent],
  template: `
    @if (badge(); as b) {
      <app-cipher-lease-badge [state]="b.state" [leaseExpiresAt]="b.expiresAt" />
    }
  `,
})
export class VaultRowLeaseBadgeComponent {
  readonly cipherId = input.required<string>();

  private readonly accountService = inject(AccountService);
  private readonly configService = inject(ConfigService);
  private readonly pamApiService = inject(PamApiService);

  private readonly cipherId$ = toObservable(this.cipherId);
  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);
  private readonly userId$ = this.accountService.activeAccount$.pipe(getUserId);

  private readonly view$: Observable<LeaseBadgeView | null> = combineLatest([
    this.cipherId$,
    this.enabled$,
    this.userId$,
  ]).pipe(
    switchMap(([cipherId, enabled, userId]) => {
      // DEMO: real gating will arrive on the cipher view via sync. Until then
      // the mock predicate decides which ciphers are gated at all.
      if (!cipherId || !enabled || !PamMockConfig.isEnabled() || !PamMockConfig.shouldGate(cipherId)) {
        return of(null);
      }
      return this.pamApiService.getCipherAccessState$(cipherId, userId).pipe(
        map(({ lease, evaluation }): LeaseBadgeView => {
          if (lease.activeLease != null) {
            return {
              state: "gated_active_lease",
              expiresAt: new Date(lease.activeLease.notAfter),
            };
          }
          return {
            state: evaluation === "automated" ? "gated_no_lease_auto" : "gated_no_lease",
            expiresAt: null,
          };
        }),
      );
    }),
  );

  private readonly viewSignal = toSignal(this.view$, { initialValue: null });
  protected readonly badge = computed(() => this.viewSignal());
}
