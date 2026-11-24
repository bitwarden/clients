import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { toObservable, toSignal } from "@angular/core/rxjs-interop";
import { combineLatest, map, of, switchMap } from "rxjs";

import { NudgesService, NudgeType } from "@bitwarden/angular/vault";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PremiumUpgradeNudgeService } from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { UserId } from "@bitwarden/common/types/guid";
import { CalloutModule, LinkModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { TOTP_NUDGE_OPTIONS } from "../../premium-upgrade-nudge-options";

@Component({
  selector: "vault-totp-upgrade-callout",
  templateUrl: "./totp-upgrade-callout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CalloutModule, LinkModule, I18nPipe],
  host: { class: "tw-block empty:tw-hidden" },
})
export class TotpUpgradeCalloutComponent {
  readonly userId = input.required<UserId>();
  readonly organizationId = input<string | null | undefined>(null);

  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly nudgesService = inject(NudgesService);
  private readonly premiumUpgradeNudgeService = inject(PremiumUpgradeNudgeService);

  protected readonly visible = toSignal(
    combineLatest([toObservable(this.userId), toObservable(this.organizationId)]).pipe(
      switchMap(([userId, organizationId]) =>
        organizationId != null
          ? of(false)
          : combineLatest([
              this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
              this.nudgesService.showNudgeSpotlight$(NudgeType.PremiumUpgradeTotp, userId),
            ]).pipe(map(([hasPremium, nudgeActive]) => !hasPremium && nudgeActive)),
      ),
    ),
    { initialValue: false },
  );

  protected async upgrade() {
    await this.premiumUpgradeNudgeService.hasPremiumOrShowUpgradeNudge(TOTP_NUDGE_OPTIONS);
  }

  protected async dismiss() {
    await this.nudgesService.dismissNudge(NudgeType.PremiumUpgradeTotp, this.userId());
  }
}
