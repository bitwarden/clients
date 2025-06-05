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
import { DialogService, ToastService } from "@bitwarden/components";

/**
 * Base class for two-factor setup components (ex: email, yubikey, webauthn, duo).
 */
@Directive({})
export abstract class TwoFactorSetupMethodBaseComponent {
  @Output() onUpdated = new EventEmitter<boolean>();

  type: TwoFactorProviderType | undefined;
  organizationId: string | null = null;
  twoFactorProviderType = TwoFactorProviderType;
  enabled = false;
  authed = false;

  protected hashedSecret: string | undefined;
  protected verificationType: VerificationType | undefined;
  protected componentName = "";

  constructor(
    protected apiService: ApiService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected userVerificationService: UserVerificationService,
    protected dialogService: DialogService,
    protected toastService: ToastService,
  ) {}

  protected auth(authResponse: AuthResponseBase) {
    this.hashedSecret = authResponse.secret;
    this.verificationType = authResponse.verificationType;
    this.authed = true;
  }

  /** @deprecated used for formPromise flows.*/
  protected async enable(enableFunction: () => Promise<void>) {
    try {
      await enableFunction();
      this.onUpdated.emit(true);
    } catch (e) {
      this.logService.error(e);
    }
  }

  /**
   * @deprecated used for formPromise flows.
   * TODO: Remove this method when formPromises are removed from all flows.
   * */
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
      if (this.type === undefined) {
        throw new Error("Two-factor provider type is required");
      }
      request.type = this.type;
      if (this.organizationId != null) {
        promise = this.apiService.putTwoFactorOrganizationDisable(this.organizationId, request);
      } else {
        promise = this.apiService.putTwoFactorDisable(request);
      }
      await promise;
      this.enabled = false;
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("twoStepDisabled"),
      });
      this.onUpdated.emit(false);
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async disableMethod() {
    const confirmed = await this.dialogService.openSimpleDialog({
      title: { key: "disable" },
      content: { key: "twoStepDisableDesc" },
      type: "warning",
    });

    if (!confirmed) {
      return;
    }

    const request = await this.buildRequestModel(TwoFactorProviderRequest);
    if (this.type === undefined) {
      throw new Error("Two-factor provider type is required");
    }
    request.type = this.type;
    if (this.organizationId != null) {
      await this.apiService.putTwoFactorOrganizationDisable(this.organizationId, request);
    } else {
      await this.apiService.putTwoFactorDisable(request);
    }
    this.enabled = false;
    this.toastService.showToast({
      variant: "success",
      title: "",
      message: this.i18nService.t("twoStepDisabled"),
    });
    this.onUpdated.emit(false);
  }

  protected async buildRequestModel<T extends SecretVerificationRequest>(
    requestClass: new () => T,
  ) {
    if (this.hashedSecret === undefined || this.verificationType === undefined) {
      throw new Error("User verification data is missing");
    }
    return this.userVerificationService.buildRequest(
      {
        secret: this.hashedSecret,
        type: this.verificationType,
      },
      requestClass,
      true,
    );
  }
}
