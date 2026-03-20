import { Component, input } from "@angular/core";

import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { ChipActionComponent } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NotPremiumDirective } from "../../directives/not-premium.directive";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-premium-badge",
  template: `
    <button
      type="button"
      *appNotPremium
      bit-chip-action
      startIcon="bwi-diamond"
      [variant]="'accent-primary'"
      (click)="promptForPremium($event)"
      [label]="'upgrade' | i18n"
    ></button>
  `,
  imports: [I18nPipe, ChipActionComponent, NotPremiumDirective],
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
