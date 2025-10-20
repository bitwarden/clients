import { Component, EventEmitter, Inject, Output } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule } from "@angular/forms";

import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { UserVerificationService } from "@bitwarden/common/auth/abstractions/user-verification/user-verification.service.abstraction";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { VerificationType } from "@bitwarden/common/auth/enums/verification-type";
import { SecretVerificationRequest } from "@bitwarden/common/auth/models/request/secret-verification.request";
import { TwoFactorApiService } from "@bitwarden/common/auth/two-factor";
import { AuthResponse } from "@bitwarden/common/auth/types/auth-response";
import { TwoFactorResponse } from "@bitwarden/common/auth/types/two-factor-response";
import { Verification } from "@bitwarden/common/auth/types/verification";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import {
  AsyncActionsModule,
  ButtonModule,
  DIALOG_DATA,
  DialogConfig,
  DialogModule,
  DialogRef,
  DialogService,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

type TwoFactorVerifyDialogData = {
  type: TwoFactorProviderType;
  organizationId: string;
};

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
 
@Component({
  selector: "app-two-factor-verify",
  templateUrl: "two-factor-verify.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    DialogModule,
    I18nPipe,
    ReactiveFormsModule,
    UserVerificationFormInputComponent,
  ],
})
export class TwoFactorVerifyComponent {
  type: TwoFactorProviderType;
  organizationId: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
   
  @Output() onAuthed = new EventEmitter<AuthResponse<TwoFactorResponse>>();

  formPromise: Promise<TwoFactorResponse> | undefined;

  protected formGroup = new FormGroup({
    secret: new FormControl<Verification | null>(null),
  });
  invalidSecret: boolean = false;

  constructor(
    @Inject(DIALOG_DATA) protected data: TwoFactorVerifyDialogData,
    private dialogRef: DialogRef,
    private twoFactorApiService: TwoFactorApiService,
    private i18nService: I18nService,
    private userVerificationService: UserVerificationService,
  ) {
    this.type = data.type;
    this.organizationId = data.organizationId;
  }

  submit = async () => {
    try {
      let hashedSecret = "";
      if (!this.formGroup.value.secret) {
        throw new Error("Secret is required");
      }

      const secret = this.formGroup.value.secret!;
      this.formPromise = this.userVerificationService.buildRequest(secret).then((request) => {
        hashedSecret =
          secret.type === VerificationType.MasterPassword
            ? request.masterPasswordHash
            : request.otp;
        return this.apiCall(request);
      });

      const response = await this.formPromise;
      this.dialogRef.close({
        response: response,
        secret: hashedSecret,
        verificationType: secret.type,
      });
    } catch (e) {
      if (e instanceof ErrorResponse && e.statusCode === 400) {
        this.invalidSecret = true;
      }
      throw e;
    }
  };

  get dialogTitle(): string {
    switch (this.type) {
      case -1 as TwoFactorProviderType:
        return this.i18nService.t("recoveryCodeTitle");
      case TwoFactorProviderType.Duo:
      case TwoFactorProviderType.OrganizationDuo:
        return "Duo";
      case TwoFactorProviderType.Email:
        return this.i18nService.t("emailTitle");
      case TwoFactorProviderType.WebAuthn:
        return this.i18nService.t("webAuthnTitle");
      case TwoFactorProviderType.Authenticator:
        return this.i18nService.t("authenticatorAppTitle");
      case TwoFactorProviderType.Yubikey:
        return "Yubikey";
      default:
        throw new Error(`Unknown two-factor type: ${this.type}`);
    }
  }

  private apiCall(request: SecretVerificationRequest): Promise<TwoFactorResponse> {
    switch (this.type) {
      case -1 as TwoFactorProviderType:
        return this.twoFactorApiService.getTwoFactorRecover(request);
      case TwoFactorProviderType.Duo:
      case TwoFactorProviderType.OrganizationDuo:
        if (this.organizationId != null) {
          return this.twoFactorApiService.getTwoFactorOrganizationDuo(this.organizationId, request);
        } else {
          return this.twoFactorApiService.getTwoFactorDuo(request);
        }
      case TwoFactorProviderType.Email:
        return this.twoFactorApiService.getTwoFactorEmail(request);
      case TwoFactorProviderType.WebAuthn:
        return this.twoFactorApiService.getTwoFactorWebAuthn(request);
      case TwoFactorProviderType.Authenticator:
        return this.twoFactorApiService.getTwoFactorAuthenticator(request);
      case TwoFactorProviderType.Yubikey:
        return this.twoFactorApiService.getTwoFactorYubiKey(request);
      default:
        throw new Error(`Unknown two-factor type: ${this.type}`);
    }
  }

  static open(dialogService: DialogService, config: DialogConfig<TwoFactorVerifyDialogData>) {
    return dialogService.open<AuthResponse<any>, TwoFactorVerifyDialogData>(
      TwoFactorVerifyComponent,
      config as DialogConfig<TwoFactorVerifyDialogData, DialogRef<AuthResponse<any>>>,
    );
  }
}
