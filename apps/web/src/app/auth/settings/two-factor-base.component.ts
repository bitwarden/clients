import { Directive, EventEmitter, Output } from "@angular/core";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { TwoFactorProviderRequest } from "@bitwarden/common/auth/models/request/two-factor-provider.request";
import { AuthResponseBase } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";

@Directive()
export abstract class TwoFactorBaseComponent {
  @Output() onUpdated = new EventEmitter<boolean>();

  type: TwoFactorProviderType;
  organizationId: string;
  twoFactorProviderType = TwoFactorProviderType;
  enabled = false;
  authed = false;

  protected hashedSecret: string;
  protected verificationType: VerificationType;
  protected componentName = "";

  constructor(
    protected apiService: ApiService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected userVerificationService: UserVerificationService,
    protected dialogService: DialogService
  ) {}

  protected auth(authResponse: AuthResponseBase) {
    this.hashedSecret = authResponse.secret;
    this.verificationType = authResponse.verificationType;
    this.authed = true;
  }

  protected async enable(enableFunction: () => Promise<void>) {
    try {
      await enableFunction();
      this.onUpdated.emit(true);
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async disable(promise: Promise<unknown>) {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "disable" },
      content: { key: "twoStepDisableDesc" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    try {
      const request = await this.buildRequestModel(TwoFactorProviderRequest);
      request.type = this.type;
      if (this.organizationId != null) {
        promise = this.apiService.putTwoFactorOrganizationDisable(this.organizationId, request);
      } else {
        promise = this.apiService.putTwoFactorDisable(request);
      }
      await promise;
      this.enabled = false;
      this.platformUtilsService.showToast("success", null, this.i18nService.t("twoStepDisabled"));
      this.onUpdated.emit(false);
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async buildRequestModel<T extends SecretVerificationRequest>(
    requestClass: new () => T
  ) {
    return this.userVerificationService.buildRequest(
      {
        secret: this.hashedSecret,
        type: this.verificationType,
      },
      requestClass,
      true
    );
  }
}
