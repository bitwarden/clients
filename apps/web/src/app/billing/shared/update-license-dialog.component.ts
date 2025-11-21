import { Component, Inject } from "@angular/core";
import { FormBuilder } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DIALOG_DATA,
  DialogConfig,
  DialogRef,
  DialogService,
  ToastService,
} from "@bitwarden/components";

import { UpdateLicenseDialogResult } from "./update-license-types";
import { UpdateLicenseComponent } from "./update-license.component";

export interface UpdateLicenseDialogData {
  fromUserSubscription?: boolean;
}

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "update-license-dialog.component.html",
  standalone: false,
})
export class UpdateLicenseDialogComponent extends UpdateLicenseComponent {
  fromUserSubscription: boolean;

  constructor(
    private dialogRef: DialogRef,
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    organizationApiService: OrganizationApiServiceAbstraction,
    formBuilder: FormBuilder,
    toastService: ToastService,
    private accountService: AccountService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    @Inject(DIALOG_DATA) private dialogData: UpdateLicenseDialogData = {},
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      organizationApiService,
      formBuilder,
      toastService,
    );
    this.fromUserSubscription = dialogData?.fromUserSubscription ?? false;
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
      this.dialogRef.close(UpdateLicenseDialogResult.Updated);
    }
  }

  submitLicenseDialog = async () => {
    await this.submitLicense();
  };

  cancel = async () => {
    await this.cancel();
    this.dialogRef.close(UpdateLicenseDialogResult.Cancelled);
  };
  static open(dialogService: DialogService, config?: DialogConfig<UpdateLicenseDialogData>) {
    return dialogService.open<UpdateLicenseDialogResult>(UpdateLicenseDialogComponent, config);
  }
}
