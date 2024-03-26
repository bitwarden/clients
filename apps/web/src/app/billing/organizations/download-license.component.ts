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
  selector: "app-download-license",
  templateUrl: "download-license.component.html",
})
export class DownloadLicenseComponent {
  licenseForm = this.formBuilder.group({
    installationId: ["", [Validators.required]],
  });
  constructor(
    @Inject(DIALOG_DATA) protected params: any,
    private dialogRef: DialogRef,
    private fileDownloadService: FileDownloadService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    protected formBuilder: FormBuilder,
  ) {}

  submit = async () => {
    this.licenseForm.markAllAsTouched();
    if (
      this.licenseForm.value.installationId == null ||
      this.licenseForm.value.installationId === ""
    ) {
      return;
    }
    const license = await this.organizationApiService.getLicense(
      this.params.organizationId,
      this.licenseForm.get("installationId").value,
    );
    const licenseString = JSON.stringify(license, null, 2);
    this.fileDownloadService.download({
      fileName: "bitwarden_organization_license.json",
      blobData: licenseString,
    });
    this.dialogRef.close(DownloadLicenseDialogResult.Downloaded);
  };
  /**
   * Strongly typed helper to open a DownloadLicenseComponent
   * @param dialogService Instance of the dialog service that will be used to open the dialog
   * @param config Configuration for the dialog
   */
  static open(dialogService: DialogService, config: DialogConfig<DownloadLicenseDialogData>) {
    return dialogService.open<DownloadLicenseDialogResult>(DownloadLicenseComponent, config);
  }
  cancel = () => {
    this.dialogRef.close(DownloadLicenseDialogResult.Cancelled);
  };
}
