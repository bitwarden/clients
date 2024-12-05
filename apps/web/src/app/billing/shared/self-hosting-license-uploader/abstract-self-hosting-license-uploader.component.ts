// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { FormBuilder, FormGroup, Validators } from "@angular/forms";

import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";

import { LicenseUploaderFormModel } from "./license-uploader-form-model";

/**
 * Shared implementation for processing license file uploads.
 * @remarks Requires self-hosting.
 */
export abstract class AbstractSelfHostingLicenseUploaderComponent {
  protected form: FormGroup;

  protected constructor(
    protected readonly formBuilder: FormBuilder,
    protected readonly i18nService: I18nService,
    protected readonly platformUtilsService: PlatformUtilsService,
    protected readonly toastService: ToastService,
    protected readonly tokenService: TokenService,
  ) {
    const isSelfHosted = this.platformUtilsService.isSelfHost();

    if (!isSelfHosted) {
      throw new Error("This component should only be used in self-hosted environments");
    }

    this.form = this.formBuilder.group({
      file: [null, [Validators.required]],
    });
    this.submit = this.submit.bind(this);
  }

  /**
   * Gets the submitted license upload form model.
   * @protected
   */
  protected get formValue(): LicenseUploaderFormModel {
    return this.form.value as LicenseUploaderFormModel;
  }

  /**
   * Triggered when a different license file is selected.
   * @param event
   */
  onLicenseFileSelectedChanged(event: Event): void {
    const element = event.target as HTMLInputElement;
    this.form.value.file = element.files.length > 0 ? element.files[0] : null;
  }

  /**
   * Submits the license upload form.
   * @protected
   */
  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      return this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("selectFile"),
      });
    }

    const emailVerified = await this.tokenService.getEmailVerified();
    if (!emailVerified) {
      return this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("verifyEmailFirst"),
      });
    }
  }

  abstract get description(): string;

  abstract get hintFileName(): string;
}
