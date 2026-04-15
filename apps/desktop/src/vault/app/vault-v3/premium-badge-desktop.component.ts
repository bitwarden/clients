import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { NotPremiumDirective } from "@bitwarden/angular/billing/directives/not-premium.directive";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ChipActionComponent, TooltipDirective } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  selector: "app-premium-badge-desktop",
  template: `
    <button
      type="button"
      *appNotPremium
      bit-chip-action
      startIcon="bwi-premium"
      [variant]="'primary'"
      [bitTooltip]="'upgradeToPremium' | i18n"
      (click)="promptForPremium($event)"
    ></button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [I18nPipe, ChipActionComponent, NotPremiumDirective, TooltipDirective],
})
export class PremiumBadgeDesktopComponent {
  readonly organizationId = input<string>();
  private readonly premiumUpgradePromptService = inject(PremiumUpgradePromptService);

  async promptForPremium(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    await this.premiumUpgradePromptService.promptForPremium(this.organizationId());
  }
}
