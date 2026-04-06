import { Component, EventEmitter, Output } from "@angular/core";
import { FormBuilder } from "@angular/forms";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import { ToastService } from "@bitwarden/components";

import { AbstractSelfHostingLicenseUploaderComponent } from "../../shared/self-hosting-license-uploader/abstract-self-hosting-license-uploader.component";

/**
 * Processes license file uploads for individual plans.
 * @remarks Requires self-hosting.
 */
// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "individual-self-hosting-license-uploader",
  templateUrl: "./self-hosting-license-uploader.component.html",
  standalone: false,
})
export class IndividualSelfHostingLicenseUploaderComponent extends AbstractSelfHostingLicenseUploaderComponent {
  /**
   * Emitted when a license file has been successfully uploaded & processed.
   */
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onLicenseFileUploaded: EventEmitter<void> = new EventEmitter<void>();

  constructor(
    protected readonly apiService: ApiService,
    protected readonly formBuilder: FormBuilder,
    protected readonly i18nService: I18nService,
    protected readonly platformUtilsService: PlatformUtilsService,
    protected readonly syncService: SyncService,
    protected readonly toastService: ToastService,
    protected readonly tokenService: TokenService,
  ) {
    super(formBuilder, i18nService, platformUtilsService, toastService, tokenService);
  }

  protected async submit(): Promise<void> {
    await super.submit();

    const formData = new FormData();
    formData.append("license", this.formValue.file);

    await this.apiService.postAccountLicense(formData);

    await this.apiService.refreshIdentityToken();
    await this.syncService.fullSync(true);

    this.onLicenseFileUploaded.emit();
  }

  get description(): string {
    return "uploadLicenseFilePremium";
  }

  get hintFileName(): string {
    return "bitwarden_premium_license.json";
  }
}
