import { Component, input } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { BadgeModule } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-premium-badge",
  standalone: true,
  template: `
    <button
      type="button"
      *appNotPremium
      bitBadge
      variant="success"
      (click)="promptForPremium($event)"
    >
      {{ "premium" | i18n }}
    </button>
  `,
  imports: [BadgeModule, JslibModule],
})
export class PremiumBadgeComponent {
  readonly organizationId = input<string>();

  constructor(private premiumUpgradePromptService: PremiumUpgradePromptService) {}

  async promptForPremium(event: Event) {
    event.stopPropagation();
    event.preventDefault();
    await this.premiumUpgradePromptService.promptForPremium(this.organizationId());
  }
}
