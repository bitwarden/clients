import { inject } from "@angular/core";
import { Router } from "@angular/router";

import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";

/**
 * This class handles the premium upgrade process for the Desktop client.
 */
export class DesktopPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private router = inject(Router);

  async promptForPremium() {
    /**
     * Navigate to the premium update screen.
     */
    await this.router.navigate(["/premium"]);
  }
}
