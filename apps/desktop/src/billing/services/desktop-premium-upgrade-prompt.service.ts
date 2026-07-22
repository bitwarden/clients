import { inject } from "@angular/core";
import { EMPTY, firstValueFrom, Observable } from "rxjs";

import { PremiumUpgradeDialogComponent } from "@bitwarden/angular/billing/components";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogService } from "@bitwarden/components";

import { PremiumComponent } from "../app/accounts/premium.component";

/**
 * This class handles the premium upgrade process for the desktop.
 */
export class DesktopPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private dialogService = inject(DialogService);
  private accountService = inject(AccountService);
  private billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private logService = inject(LogService);

  readonly upgradeConfirmed$: Observable<boolean> = EMPTY;

  async promptForPremium() {
    // The caller's message loop floats this promise, so a rejection here would vanish unlogged.
    try {
      const account = await firstValueFrom(this.accountService.activeAccount$);
      if (!account) {
        this.logService.warning(
          "[DesktopPremiumUpgradePromptService] promptForPremium called with no active account.",
        );
        return;
      }

      const hasPremium = await firstValueFrom(
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      );

      if (hasPremium) {
        // Users with premium should see the status-aware membership view rather than the upgrade pitch.
        this.dialogService.open(PremiumComponent);
        return;
      }

      PremiumUpgradeDialogComponent.open(this.dialogService);
    } catch (e) {
      this.logService.error("[DesktopPremiumUpgradePromptService] Failed to prompt for premium", e);
    }
  }
}
