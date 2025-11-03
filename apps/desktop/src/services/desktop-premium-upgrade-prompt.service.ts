import { inject } from "@angular/core";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService } from "@bitwarden/components";

/**
 * This class handles the premium upgrade process for the desktop.
 */
export class DesktopPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private messagingService = inject(MessagingService);
  private configService = inject(ConfigService);
  private dialogService = inject(DialogService);

  async promptForPremium() {
    const showNewDialog = await this.configService.getFeatureFlag(
      FeatureFlag.PM23713_PremiumBadgeOpensNewPremiumUpgradeDialog,
    );

    if (showNewDialog) {
      PremiumUpgradeDialogComponent.open(this.dialogService);
    } else {
      this.messagingService.send("openPremium");
    }
  }
}
