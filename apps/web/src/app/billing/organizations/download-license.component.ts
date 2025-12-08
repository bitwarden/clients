// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Inject } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { FileDownloadService } from "@bitwarden/common/platform/abstractions/file-download/file-download.service";
import { DialogConfig, DIALOG_DATA, DialogRef, DialogService } from "@bitwarden/components";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum DownloadLicenseDialogResult {
  Cancelled = "cancelled",
  Downloaded = "downloaded",
}
type DownloadLicenseDialogData = {
  /** current organization id */
  organizationId: string;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  templateUrl: "download-license.component.html",
  standalone: false,
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
