import { inject, Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom, map, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { DialogService } from "@bitwarden/components";
import { BILLING_DISK_LOCAL, StateProvider, UserKeyDefinition } from "@bitwarden/state";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "../unified-upgrade-dialog/unified-upgrade-dialog.component";

const SELF_HOST_SUBSCRIPTION_URL = "/settings/subscription/premium";

export const UPGRADE_CALLOUT_DISMISSED_KEY = new UserKeyDefinition<boolean>(
  BILLING_DISK_LOCAL,
  "upgradeCalloutDismissed",
  {
    deserializer: (value: boolean) => value,
    clearOn: [],
  },
);

/**
 * Drives the user-initiated upgrade flow: self-hosted users go to the subscription page,
 * cloud users get the unified upgrade dialog and are synced or redirected based on the outcome.
 * Also tracks dismissal of the side nav upgrade callout.
 */
@Injectable({ providedIn: "root" })
export class UpgradeFlowService {
  private readonly dialogService = inject(DialogService);
  private readonly accountService = inject(AccountService);
  private readonly syncService = inject(SyncService);
  private readonly router = inject(Router);
  private readonly platformUtilsService = inject(PlatformUtilsService);
  private readonly stateProvider = inject(StateProvider);

  readonly calloutDismissed$: Observable<boolean> = this.accountService.activeAccount$.pipe(
    switchMap((account) =>
      account == null
        ? of(true)
        : this.stateProvider
            .getUserState$(UPGRADE_CALLOUT_DISMISSED_KEY, account.id)
            .pipe(map((dismissed) => dismissed ?? false)),
    ),
  );

  async upgrade(): Promise<void> {
    if (this.platformUtilsService.isSelfHost()) {
      await this.router.navigate([SELF_HOST_SUBSCRIPTION_URL]);
      return;
    }

    await this.openUpgradeDialog();
  }

  async dismissCallout(): Promise<void> {
    const account = await firstValueFrom(this.accountService.activeAccount$);
    if (account == null) {
      return;
    }

    await this.stateProvider.setUserState(UPGRADE_CALLOUT_DISMISSED_KEY, true, account.id);
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
