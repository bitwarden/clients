import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

@Component({
  selector: "app-update-license",
  templateUrl: "update-license.component.html",
})
export class UpdateLicenseComponent {
  @Input() organizationId: string;
  @Input() showCancel = true;
  @Input() showAutomaticSyncAndManualUpload: boolean;
  @Output() onUpdated = new EventEmitter();
  @Output() onCanceled = new EventEmitter();

  formPromise: Promise<void>;
  title: string = this.i18nService.t("updateLicense");
  updateLicenseForm = this.formBuilder.group({
    file: [null, Validators.required],
  });
  licenseFile: File = null;
  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private formBuilder: FormBuilder,
  ) {}
  protected setSelectedFile(event: Event) {
    const fileInputEl = <HTMLInputElement>event.target;
    const file: File = fileInputEl.files.length > 0 ? fileInputEl.files[0] : null;
    this.licenseFile = file;
  }
  submit = async () => {
    this.updateLicenseForm.markAllAsTouched();
    if (this.updateLicenseForm.invalid) {
      return;
    }
    const files = this.licenseFile;
    if (files == null) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("selectFile"),
      );
      return;
    }
    const fd = new FormData();
    fd.append("license", files);

    let updatePromise: Promise<void | unknown> = null;
    if (this.organizationId == null) {
      updatePromise = this.apiService.postAccountLicense(fd);
    } else {
      updatePromise = this.organizationApiService.updateLicense(this.organizationId, fd);
    }

    this.formPromise = updatePromise.then(() => {
      return this.apiService.refreshIdentityToken();
    });

    await this.formPromise;
    this.platformUtilsService.showToast(
      "success",
      null,
      this.i18nService.t("licenseUploadSuccess"),
    );
    this.onUpdated.emit();
  };

  cancel = () => {
    this.onCanceled.emit();
  };
}
