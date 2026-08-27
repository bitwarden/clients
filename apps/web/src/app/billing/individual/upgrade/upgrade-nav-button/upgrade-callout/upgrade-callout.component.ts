import { ChangeDetectionStrategy, Component, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { ButtonComponent, CalloutComponent, DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "../../unified-upgrade-dialog/unified-upgrade-dialog.component";

@Component({
  selector: "app-upgrade-callout",
  imports: [CalloutComponent, ButtonComponent, I18nPipe],
  templateUrl: "./upgrade-callout.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UpgradeCalloutComponent {
  private readonly dialogService = inject(DialogService);
  private readonly accountService = inject(AccountService);
  private readonly syncService = inject(SyncService);
  private readonly router = inject(Router);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  protected readonly dismissed = signal(false);

  protected readonly upgrade = async () => {
    if (this.platformUtilsService.isSelfHost()) {
      await this.navigateToSelfHostSubscriptionPage();
    } else {
      await this.openUpgradeDialog();
    }
  };

  private async navigateToSelfHostSubscriptionPage(): Promise<void> {
    const subscriptionUrl = "/settings/subscription/premium";
    await this.router.navigate([subscriptionUrl]);
  }

  private async openUpgradeDialog() {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (!account) {
      return;
    }

    const dialogRef = UnifiedUpgradeDialogComponent.open(this.dialogService, {
      data: {
        account,
        planSelectionStepTitleOverride: "upgradeYourPlan",
        hideContinueWithoutUpgradingButton: true,
      },
    });

    const result = await lastValueFrom(dialogRef.closed);

    if (result?.status === UnifiedUpgradeDialogStatus.UpgradedToPremium) {
      await this.syncService.fullSync(true);
    } else if (result?.status === UnifiedUpgradeDialogStatus.UpgradedToFamilies) {
      const redirectUrl = `/organizations/${result.organizationId}/vault`;
      await this.router.navigate([redirectUrl]);
    }
  }
}
