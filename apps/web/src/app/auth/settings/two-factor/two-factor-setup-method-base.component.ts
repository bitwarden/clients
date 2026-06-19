import { Directive, EventEmitter, Output } from "@angular/core";

import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { TwoFactorService } from "@bitwarden/common/auth/two-factor";
import { AuthResponseBase } from "@bitwarden/common/auth/types/auth-response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService, ToastService } from "@bitwarden/components";

/**
 * Base class for two-factor setup components (ex: email, yubikey, webauthn, duo).
 *
 * Subclasses must implement `disableMethod()` themselves — each provider routes to its own
 * per-provider DELETE endpoint via the threaded user-verification token, so there is no
 * meaningful generic implementation to share.
 */
@Directive({})
export abstract class TwoFactorSetupMethodBaseComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-output-emitter-ref
  @Output() onUpdated = new EventEmitter<boolean>();

  type: TwoFactorProviderType | undefined;
  organizationId: string | null = null;
  twoFactorProviderType = TwoFactorProviderType;
  enabled = false;
  authed = false;

  protected secret: string | undefined;
  protected verificationType: VerificationType | undefined;
  protected componentName = "";

  constructor(
    protected twoFactorService: TwoFactorService,
    protected i18nService: I18nService,
    protected platformUtilsService: PlatformUtilsService,
    protected logService: LogService,
    protected userVerificationService: UserVerificationService,
    protected dialogService: DialogService,
    protected toastService: ToastService,
  ) {}

  protected auth(authResponse: AuthResponseBase) {
    this.secret = authResponse.secret;
    this.verificationType = authResponse.verificationType;
    this.authed = true;
  }

  protected abstract disableMethod(): Promise<void>;

  protected async buildRequestModel<T extends SecretVerificationRequest>(
    requestClass: new () => T,
  ) {
    if (this.secret === undefined || this.verificationType === undefined) {
      throw new Error("User verification data is missing");
    }
    return this.userVerificationService.buildRequest(
      {
        secret: this.secret,
        type: this.verificationType,
      },
      requestClass,
      true,
    );
  }
}
