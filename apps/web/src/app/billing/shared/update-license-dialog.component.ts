import { DialogRef } from "@angular/cdk/dialog";
import { Component } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

import { UpdateLicenseComponent } from "./update-license.component";

export enum UpdateLicenseDialogResult {
  Updated = "updated",
  Cancelled = "cancelled",
}
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
  ) {
    super(apiService, i18nService, platformUtilsService, organizationApiService, formBuilder);
  }
  async submitLicense() {
    await this.submit();
  }
  submitLicenseDialog = async () => {
    await this.submitLicense();
    this.dialogRef.close(UpdateLicenseDialogResult.Updated);
  };

  cancel = async () => {
    await this.cancel();
    this.dialogRef.close(UpdateLicenseDialogResult.Cancelled);
  };
  static open(dialogService: DialogService) {
    return dialogService.open<UpdateLicenseDialogResult>(UpdateLicenseDialogComponent);
  }
}
