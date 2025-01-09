import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

import { UpdateLicenseDialogResult } from "./update-license-types";
import { UpdateLicenseComponent } from "./update-license.component";

@Component({
  templateUrl: "update-license-dialog.component.html",
})
export class UpdateLicenseDialogComponent extends UpdateLicenseComponent {
  constructor(
    private dialogRef: DialogRef,
    apiService: ApiService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    organizationApiService: OrganizationApiServiceAbstraction,
    formBuilder: FormBuilder,
    toastService: ToastService,
  ) {
    super(
      apiService,
      i18nService,
      platformUtilsService,
      organizationApiService,
      formBuilder,
      toastService,
    );
  }
  async submitLicense() {
    const result = await this.submit();
    if (result === UpdateLicenseDialogResult.Updated) {
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
  static open(dialogService: DialogService) {
    return dialogService.open<UpdateLicenseDialogResult>(UpdateLicenseDialogComponent);
  }
}
