import { Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { BadgeModule } from "@bitwarden/components";

@Component({
  selector: "app-premium-badge",
  standalone: true,
  template: `
    <button type="button" *appNotPremium bitBadge variant="success" (click)="promptForPremium()">
      {{ "premium" | i18n }}
    </button>
  `,
  imports: [BadgeModule, JslibModule],
})
export class PremiumBadgeComponent {
  organizationId = input<string>();

  constructor(private premiumUpgradePromptService: PremiumUpgradePromptService) {}

  async promptForPremium() {
    await this.premiumUpgradePromptService.promptForPremium(this.organizationId());
  }
}
