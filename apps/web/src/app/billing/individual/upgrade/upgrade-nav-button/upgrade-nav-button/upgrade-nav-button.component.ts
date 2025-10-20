import { Component, inject } from "@angular/core";
import { Router } from "@angular/router";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { SyncService } from "@bitwarden/common/vault/abstractions/sync/sync.service.abstraction";
import { DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import {
  UnifiedUpgradeDialogComponent,
  UnifiedUpgradeDialogStatus,
} from "../../unified-upgrade-dialog/unified-upgrade-dialog.component";

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

  openUpgradeDialog = async () => {
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
      await this.apiService.refreshIdentityToken();
      await this.syncService.fullSync(true);
    } else if (result?.status === UnifiedUpgradeDialogStatus.UpgradedToFamilies) {
      const redirectUrl = `/organizations/${result.organizationId}/vault`;
      void this.router.navigate([redirectUrl]);
    }
  };
}
