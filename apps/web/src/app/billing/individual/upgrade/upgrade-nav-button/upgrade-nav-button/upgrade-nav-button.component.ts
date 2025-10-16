import { Component, inject } from "@angular/core";
import { firstValueFrom, lastValueFrom } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { DialogService } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { UnifiedUpgradeDialogComponent } from "../../unified-upgrade-dialog/unified-upgrade-dialog.component";

@Component({
  selector: "app-upgrade-nav-button",
  imports: [I18nPipe],
  templateUrl: "./upgrade-nav-button.component.html",
  standalone: true,
})
export class UpgradeNavButtonComponent {
  private dialogService = inject(DialogService);
  private accountService = inject(AccountService);

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

    await lastValueFrom(dialogRef.closed);
  };
}
