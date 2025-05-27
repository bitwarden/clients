import { Component } from "@angular/core";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { SharedModule } from "../../shared";

@Component({
  selector: "app-premium-badge",
  template: `
    <button type="button" *appNotPremium bitBadge variant="success" (click)="premiumRequired()">
      {{ "premium" | i18n }}
    </button>
  `,
  standalone: true,
  imports: [SharedModule],
})
export class PremiumBadgeComponent {
  constructor(private messagingService: MessagingService) {}

  premiumRequired() {
    this.messagingService.send("premiumRequired");
  }
}
