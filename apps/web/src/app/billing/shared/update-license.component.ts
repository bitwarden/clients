// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { OrganizationApiServiceAbstraction } from "@bitwarden/common/admin-console/abstractions/organization/organization-api.service.abstraction";
import { ProductTierType } from "@bitwarden/common/billing/enums";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { UpdateLicenseDialogResult } from "./update-license-types";

@Component({
  selector: "app-update-license",
  templateUrl: "update-license.component.html",
  standalone: false,
})
export class UpdateLicenseComponent implements OnInit {
  @Input() organizationId: string;
  @Input() showCancel = true;
  @Input() showAutomaticSyncAndManualUpload: boolean;
  @Output() onUpdated = new EventEmitter();
  @Output() onCanceled = new EventEmitter();

  formPromise: Promise<void>;
  title: string = this.i18nService.t("updateLicense");
  updateLicenseForm = this.formBuilder.group({
    file: [null],
  });
  licenseFile: File = null;
  constructor(
    private apiService: ApiService,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private organizationApiService: OrganizationApiServiceAbstraction,
    private formBuilder: FormBuilder,
    private toastService: ToastService,
  ) {}
  async ngOnInit() {
    const org = await this.organizationApiService.get(this.organizationId);
    if (org.plan.productTier !== ProductTierType.Families) {
      this.updateLicenseForm.setValidators([Validators.required]);
      this.updateLicenseForm.updateValueAndValidity();
    }
  }
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
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFile"),
      });
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
    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("licenseUploadSuccess"),
    });
    this.onUpdated.emit();
    return new Promise((resolve) => resolve(UpdateLicenseDialogResult.Updated));
  };

  cancel = () => {
    this.onCanceled.emit();
  };
}
