// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { DialogConfig, DIALOG_DATA, DialogRef } from "@angular/cdk/dialog";
import { Component, Inject } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { DialogService } from "@bitwarden/components";

export enum DownloadLicenseDialogResult {
  Cancelled = "cancelled",
  Downloaded = "downloaded",
}
type DownloadLicenseDialogData = {
  /** current organization id */
  organizationId: string;
};

@Component({
  templateUrl: "download-license.component.html",
})
export class DownloadLicenceDialogComponent {
  licenseForm = this.formBuilder.group({
    installationId: ["", [Validators.required]],
  });
  constructor(
    @Inject(DIALOG_DATA) protected data: DownloadLicenseDialogData,
    private dialogRef: DialogRef,
    private fileDownloadService: FileDownloadService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    protected formBuilder: FormBuilder,
  ) {}

  submit = async () => {
    this.licenseForm.markAllAsTouched();
    const installationId = this.licenseForm.get("installationId").value;
    if (installationId == null || installationId === "") {
      return;
    }
    const license = await this.organizationApiService.getLicense(
      this.data.organizationId,
      installationId,
    );
    const licenseString = JSON.stringify(license, null, 2);
    this.fileDownloadService.download({
      fileName: "bitwarden_organization_license.json",
      blobData: licenseString,
    });
    this.dialogRef.close(DownloadLicenseDialogResult.Downloaded);
  };
  /**
   * Strongly typed helper to open a DownloadLicenceDialogComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open(dialogService: DialogService, config: DialogConfig<DownloadLicenseDialogData>) {
    return dialogService.open<DownloadLicenseDialogResult>(DownloadLicenceDialogComponent, config);
  }
  cancel = () => {
    this.dialogRef.close(DownloadLicenseDialogResult.Cancelled);
  };
}
