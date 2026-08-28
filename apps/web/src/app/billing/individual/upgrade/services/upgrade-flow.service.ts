import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService } from "@bitwarden/components";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

const SELF_HOST_SUBSCRIPTION_URL = "/settings/subscription/premium";

/**
 * Drives the user-initiated upgrade flow: self-hosted users go to the subscription page,
 * cloud users get the unified upgrade dialog and are synced or redirected based on the outcome.
 */
@Injectable({ providedIn: "root" })
export class UpgradeFlowService {
  private readonly dialogService = inject(DialogService);
  private readonly accountService = inject(AccountService);
  private readonly syncService = inject(SyncService);
  private readonly router = inject(Router);
  private readonly platformUtilsService = inject(PlatformUtilsService);

  async upgrade(): Promise<void> {
    if (this.platformUtilsService.isSelfHost()) {
      await this.router.navigate([SELF_HOST_SUBSCRIPTION_URL]);
      return;
    }

    await this.openUpgradeDialog();
  }

  private async openUpgradeDialog(): Promise<void> {
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
      await this.router.navigate([`/organizations/${result.organizationId}/vault`]);
    }
  }
}
