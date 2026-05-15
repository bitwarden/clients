import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

import { IconModule, IconTileComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

@Component({
  templateUrl: "./premium-checkout-success.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, I18nPipe, IconModule, IconTileComponent, TypographyModule],
})
export class PremiumCheckoutSuccessComponent {
  // Rendered at an anonymous route — we can't call AccountBillingClient here.
  // Premium is an annual subscription, so renewal = today + 1 year.
  protected readonly planNameKey = "premium";
  protected readonly startDate: Date = new Date();
  protected readonly renewalDate: Date = (() => {
    const renewal = new Date(this.startDate);
    renewal.setFullYear(renewal.getFullYear() + 1);
    return renewal;
  })();
}
