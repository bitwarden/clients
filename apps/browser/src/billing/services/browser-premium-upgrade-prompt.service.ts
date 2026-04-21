import { inject } from "@angular/core";
import { EMPTY, Observable } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService } from "@bitwarden/components";

/**
 * This class handles the premium upgrade process for the browser extension.
 */
export class BrowserPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private dialogService = inject(DialogService);

  readonly upgradeConfirmed$: Observable<boolean> = EMPTY;

  async promptForPremium() {
    PremiumUpgradeDialogComponent.open(this.dialogService);
  }
}
