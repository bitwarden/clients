import { Component, input, output } from "@angular/core";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
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
  /** Skip sending the premiumRequired message (default: false). */
  skipMessaging = input(false);
  onClick = output();

  constructor(private messagingService: MessagingService) {}

  async promptForPremium() {
    this.onClick.emit();
    if (this.skipMessaging()) {
      return;
    }
    this.messagingService.send("premiumRequired");
  }
}
