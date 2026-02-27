import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "../../unified-upgrade-dialog/unified-upgrade-dialog.component";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-upgrade-nav-button",
  imports: [I18nPipe],
  templateUrl: "./upgrade-nav-button.component.html",
  standalone: true,
})
export class UpgradeNavButtonComponent {
  private dialogService = inject(DialogService);
  private accountService = inject(AccountService);
  private syncService = inject(SyncService);
  private apiService = inject(ApiService);
  private router = inject(Router);
  private platformUtilsService = inject(PlatformUtilsService);

  upgrade = async () => {
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
