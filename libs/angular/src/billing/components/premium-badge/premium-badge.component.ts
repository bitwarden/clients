import { ChangeDetectionStrategy, Component, computed, inject, input } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { BadgeComponent, BitIconButtonComponent, ChipActionComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NotPremiumDirective } from "../../directives/not-premium.directive";

type ComponentMode = "premiumBadge" | "upgradeIcon" | "upgradeChip";

@Component({
  selector: "app-premium-badge",
  template: `
    @switch (mode()) {
      @case ("premiumBadge") {
        <span *appNotPremium bitBadge variant="primary" size="small" startIcon="bwi-premium">
          {{ "premium" | i18n }}
        </span>
      }
      @case ("upgradeIcon") {
        <button
          type="button"
          buttonType="side-nav"
          size="xsmall"
          *appNotPremium
          bitIconButton="bwi-premium"
          [label]="'upgradeToPremium' | i18n"
          (click)="promptForPremium($event)"
        ></button>
      }
      @case ("upgradeChip") {
        <button
          type="button"
          *appNotPremium
          bit-chip-action
          startIcon="bwi-premium"
          [variant]="'accent-primary'"
          (click)="promptForPremium($event)"
          [label]="'upgrade' | i18n"
        ></button>
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    I18nPipe,
    BadgeComponent,
    BitIconButtonComponent,
    ChipActionComponent,
    NotPremiumDirective,
  ],
})
export class PremiumBadgeComponent {
  readonly organizationId = input<string>();
  readonly iconOnly = input<boolean>(false);

  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);
  private readonly configService = inject(ConfigService);

  protected readonly featureBasedUpgradePaths = toSignal(
    this.configService.getFeatureFlag$(FeatureFlag.PM42214_FeatureBasedUpgradePaths),
    { initialValue: false },
  );

  /** The single visual state the template renders; the flag-on state takes precedence. */
  protected readonly mode = computed<ComponentMode>(() => {
    if (this.featureBasedUpgradePaths()) {
      return "premiumBadge";
    }
    return this.iconOnly() ? "upgradeIcon" : "upgradeChip";
  });

  /** Open the upgrade prompt. */
  async promptForPremium(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    await this.premiumUpgradePromptService.promptForPremium(this.organizationId());
  }
}
