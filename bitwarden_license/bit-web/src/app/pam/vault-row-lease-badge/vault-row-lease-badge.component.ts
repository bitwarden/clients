import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { catchError, combineLatest, from, map, Observable, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { CipherViewLike } from "@bitwarden/common/vault/utils/cipher-view-like-utils";
import { IconComponent, TooltipDirective } from "@bitwarden/components";

import { AccessRequestSdkService } from "../abstractions/access-request-sdk.service";
import { formatRemaining } from "../date/format-remaining";

type LeaseBadgeState = "gated_no_lease" | "gated_active_lease";
type LeaseBadgeView = { state: LeaseBadgeState; expiresAt: Date | null };

/**
 * Renders the "Controlled access" / "Privileged" lease badge for one row in the vault list
 * (bound to `VAULT_ROW_LEASE_BADGE`). Encapsulates every PAM dependency so the row component
 * stays PAM-free: pass the row's cipher, get a badge (or nothing) back.
 *
 * Fetches the cipher's access state once per cipher/flag change (not on an interval — a
 * vault list can render many gated rows at once, and the reveal-in-place behavior that needs
 * live polling lives in the cipher-view banner / gated-cipher reloader, not here). The
 * active-lease countdown still ticks locally once fetched.
 */
@Component({
  selector: "app-pam-vault-row-lease-badge",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, TooltipDirective],
  templateUrl: "./vault-row-lease-badge.component.html",
})
export class VaultRowLeaseBadgeComponent {
  readonly cipher = input.required<CipherViewLike>();

  private readonly configService = inject(ConfigService);
  private readonly accessRequestSdkService = inject(AccessRequestSdkService);
  private readonly i18nService = inject(I18nService);

  private readonly cipher$ = toObservable(this.cipher);
  private readonly enabled$ = this.configService.getFeatureFlag$(FeatureFlag.Pam);

  private readonly view$: Observable<LeaseBadgeView | null> = combineLatest([
    this.cipher$,
    this.enabled$,
  ]).pipe(
    switchMap(([cipher, enabled]) => {
      // Gating is driven by the SDK's `partial` flag, carried on both `CipherView` and
      // `CipherListView`. No flag, no id, or the flag off — no badge.
      if (!enabled || !cipher.partial || cipher.id == null) {
        return of(null);
      }
      return from(this.accessRequestSdkService.getCipherAccessState(String(cipher.id))).pipe(
        map((state): LeaseBadgeView =>
          state.activeLease != null
            ? { state: "gated_active_lease", expiresAt: new Date(state.activeLease.notAfter) }
            : { state: "gated_no_lease", expiresAt: null },
        ),
        catchError(() => of(null)),
      );
    }),
  );

  protected readonly badge = toSignal(this.view$, { initialValue: null });

  private readonly now = signal(Date.now());

  protected readonly isActiveLease = computed(() => this.badge()?.state === "gated_active_lease");

  protected readonly remainingLabel = computed(() => {
    const expiresAt = this.badge()?.expiresAt;
    if (expiresAt == null) {
      return "0s";
    }
    return formatRemaining(expiresAt.getTime() - this.now());
  });

  protected readonly tooltip = computed(() => {
    const state = this.badge()?.state;
    if (state === "gated_active_lease") {
      return this.i18nService.t("cipherLeaseExpiresIn", this.remainingLabel());
    }
    if (state === "gated_no_lease") {
      return this.i18nService.t("cipherLeaseRequiresApproval");
    }
    return "";
  });

  constructor() {
    effect((onCleanup) => {
      if (!this.isActiveLease()) {
        return;
      }
      const id = setInterval(() => this.now.set(Date.now()), 1000);
      onCleanup(() => clearInterval(id));
    });
  }
}
