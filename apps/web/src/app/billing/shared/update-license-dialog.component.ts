import { Component, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { DIALOG_DATA, DialogConfig, DialogRef, DialogService } from "@bitwarden/components";

import { UpdateLicenseDialogResult } from "./update-license-types";
import { UpdateLicenseComponent } from "./update-license.component";

export interface UpdateLicenseDialogData {
  fromUserSubscriptionPage?: boolean;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "update-license-dialog.component.html",
  standalone: false,
})
export class UpdateLicenseDialogComponent extends UpdateLicenseComponent {
  private dialogRef = inject(DialogRef);
  private accountService = inject(AccountService);
  private billingAccountProfileStateService = inject(BillingAccountProfileStateService);
  private dialogData = inject<UpdateLicenseDialogData>(DIALOG_DATA) ?? {};

  fromUserSubscriptionPage: boolean;

  constructor() {
    super();
    this.fromUserSubscriptionPage = this.dialogData?.fromUserSubscriptionPage ?? false;
  }
  async submitLicense() {
    const result = await this.submit();
    if (result === UpdateLicenseDialogResult.Updated) {
      // Update billing state after successful upload (only for personal licenses)
      if (this.organizationId == null) {
        const account: Account | null = await firstValueFrom(this.accountService.activeAccount$);
        if (account) {
          const hasPremiumFromAnyOrganization = await firstValueFrom(
            this.billingAccountProfileStateService.hasPremiumFromAnyOrganization$(account.id),
          );
          await this.billingAccountProfileStateService.setHasPremium(
            true,
            hasPremiumFromAnyOrganization,
            account.id,
          );
        }
      }
      await this.dialogRef.close(UpdateLicenseDialogResult.Updated);
    }
  }

  submitLicenseDialog = async () => {
    await this.submitLicense();
  };

  cancel = async () => {
    this.onCanceled.emit();
    await this.dialogRef.close(UpdateLicenseDialogResult.Cancelled);
  };
  static open(dialogService: DialogService, config?: DialogConfig<UpdateLicenseDialogData>) {
    return dialogService.open<UpdateLicenseDialogResult>(UpdateLicenseDialogComponent, config);
  }
}
