import { Injectable, Optional } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, Subject } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { PremiumUpgradePromptService } from "@bitwarden/common/vault/abstractions/premium-upgrade-prompt.service";
import { DialogRef, DialogService } from "@bitwarden/components";
import { VaultItemDialogResult } from "@bitwarden/vault";
import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "@bitwarden/web-vault/app/billing/individual/upgrade/unified-upgrade-dialog/unified-upgrade-dialog.component";

@Injectable()
export class WebVaultPremiumUpgradePromptService implements PremiumUpgradePromptService {
  private readonly _upgradeConfirmed$ = new Subject<boolean>();
  readonly upgradeConfirmed$ = this._upgradeConfirmed$.asObservable();

  constructor(
    private dialogService: DialogService,
    private accountService: AccountService,
    private syncService: SyncService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    @Optional() private dialog?: DialogRef<VaultItemDialogResult>,
  ) {}
  private readonly subscriptionPageRoute = "settings/subscription/premium";

  /**
   * Prompts the user for a premium upgrade.
   */
  async promptForPremium(organizationId?: OrganizationId) {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    // Personal premium doesn't cover an organization's storage allocation, so the org upgrade
    // path below always runs regardless of the user's own premium status.
    if (!organizationId) {
      const hasPremium = await firstValueFrom(
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      );
      if (hasPremium) {
        // Already has premium, don't prompt
        return;
      }

      // Per conversation in PM-23713, retain the existing upgrade org flow for now, will be addressed
      //  as a part of https://bitwarden.atlassian.net/browse/PM-25507
      await this.promptForPremiumVNext(account);
      return;
    }

    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "upgradeOrganization" },
      content: { key: "upgradeOrganizationDesc" },
      acceptButtonText: { key: "upgradeOrganization" },
      type: "info",
    });

    this._upgradeConfirmed$.next(confirmed);

    if (confirmed) {
      await this.router.navigate(["organizations", organizationId, "billing", "subscription"]);
    }
    if (confirmed && this.dialog) {
      await this.dialog.close(VaultItemDialogResult.PremiumUpgrade);
    }
  }

  private async promptForPremiumVNext(account: Account) {
    await (this.platformUtilsService.isSelfHost()
      ? this.redirectToSubscriptionPage()
      : this.openUpgradeDialog(account));
  }

  private async redirectToSubscriptionPage() {
    await this.router.navigate([this.subscriptionPageRoute]);
    if (this.dialog) {
      await this.dialog.close(VaultItemDialogResult.PremiumUpgrade);
    }
  }

  private async openUpgradeDialog(account: Account) {
    const dialogRef = UnifiedUpgradeDialogComponent.open(this.dialogService, {
      data: {
        account,
        planSelectionStepTitleOverride: "upgradeYourPlan",
        hideContinueWithoutUpgradingButton: true,
      },
    });
    const result = await lastValueFrom(dialogRef.closed);
    if (
      result?.status === UnifiedUpgradeDialogStatus.UpgradedToPremium ||
      result?.status === UnifiedUpgradeDialogStatus.UpgradedToFamilies
    ) {
      await this.syncService.fullSync(true);
    }
  }
}
