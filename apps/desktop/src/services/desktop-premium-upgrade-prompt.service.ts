import { inject } from "@angular/core";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";

/**
 * This class handles the premium upgrade process for the desktop.
 */
export class DesktopPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private messagingService = inject(MessagingService);

  async promptForPremium() {
    this.messagingService.send("openPremium");
  }
}
