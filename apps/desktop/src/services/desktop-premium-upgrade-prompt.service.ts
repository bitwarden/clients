import { inject } from "@angular/core";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService } from "@bitwarden/components";

/**
 * This class handles the premium upgrade process for the desktop.
 */
export class DesktopPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private dialogService = inject(DialogService);

  async promptForPremium() {
    PremiumUpgradeDialogComponent.open(this.dialogService);
  }
}
