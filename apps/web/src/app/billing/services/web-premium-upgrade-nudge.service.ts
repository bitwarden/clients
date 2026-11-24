import { Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";
import { filter, firstValueFrom, switchMap } from "rxjs";

import { PremiumUpgradeNudgeComponent } from "@bitwarden/angular/billing/components/premium-upgrade-nudge/premium-upgrade-nudge.component";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import {
  PremiumUpgradeNudgeOptions,
  PremiumUpgradeNudgeService,
} from "@bitwarden/common/billing/abstractions/premium-upgrade-nudge.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService } from "@bitwarden/components";
import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "@bitwarden/web-vault/app/billing/individual/upgrade/unified-upgrade-dialog/unified-upgrade-dialog.component";

@Injectable()
export class WebPremiumUpgradeNudgeService implements PremiumUpgradeNudgeService {
  private readonly accountService = inject(AccountService);
  private readonly billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private readonly dialogService = inject(DialogService);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly router = inject(Router);
  private readonly syncService = inject(SyncService);
  private readonly logService = inject(LogService);

  private readonly subscriptionPageRoute = "settings/subscription/premium";

  async hasPremiumOrShowUpgradeNudge(options: PremiumUpgradeNudgeOptions): Promise<boolean> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account == null) {
      throw new Error("Null or undefined account");
    }
    const hasPremium = await firstValueFrom(
      this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
    );
    if (hasPremium) {
      return true;
    }
    PremiumUpgradeNudgeComponent.open(this.dialogService, {
      data: { options, upgrade: () => this.upgrade(account) },
    });
    return false;
  }

  private async upgrade(account: Account): Promise<void> {
    if (this.platformUtilsService.isSelfHost()) {
      await this.router.navigate([this.subscriptionPageRoute]);
      return;
    }
    this.openInAppCheckout(account);
  }

  private openInAppCheckout(account: Account): void {
    const dialogRef = UnifiedUpgradeDialogComponent.open(this.dialogService, {
      data: {
        account,
        planSelectionStepTitleOverride: "upgradeYourPlan",
        hideContinueWithoutUpgradingButton: true,
      },
    });
    // Sync from a subscription, not an await, so the nudge closes as this dialog opens.
    dialogRef.closed
      .pipe(
        filter(
          (result) =>
            result?.status === UnifiedUpgradeDialogStatus.UpgradedToPremium ||
            result?.status === UnifiedUpgradeDialogStatus.UpgradedToFamilies,
        ),
        switchMap(() => this.syncService.fullSync(true)),
      )
      .subscribe({
        error: (e: unknown) => this.logService.error("Post-upgrade sync failed", e),
      });
  }
}
