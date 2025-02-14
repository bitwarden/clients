import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import { LoginStrategyServiceAbstraction, PasswordLoginCredentials } from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { TwoFactorRecoveryRequest } from "@bitwarden/common/auth/models/request/two-factor-recovery.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

@Component({
  selector: "app-recover-two-factor",
  templateUrl: "recover-two-factor.component.html",
})
export class RecoverTwoFactorComponent implements OnInit {
  protected formGroup = new FormGroup({
    email: new FormControl(null, [Validators.required]),
    masterPassword: new FormControl(null, [Validators.required]),
    recoveryCode: new FormControl(null, [Validators.required]),
  });

  /**
   * Message to display to the user about the recovery code
   */
  recoveryCodeMessage: string;

  /**
   * Whether the recovery code login feature flag is enabled
   */
  private recoveryCodeLoginFeatureFlagEnabled: boolean;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private toastService: ToastService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.recoveryCodeLoginFeatureFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.RecoveryCodeLogin,
    );
    this.recoveryCodeMessage = this.recoveryCodeLoginFeatureFlagEnabled
      ? this.i18nService.t("logInBelowUsingYourSingleUseRecoveryCode")
      : this.i18nService.t("recoverAccountTwoStepDesc");
  }

  get email(): string {
    return this.formGroup.value.email;
  }

  get masterPassword(): string {
    return this.formGroup.value.masterPassword;
  }

  get recoveryCode(): string {
    return this.formGroup.value.recoveryCode;
  }

  async submit() {
    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const request = new TwoFactorRecoveryRequest();
    request.recoveryCode = this.recoveryCode.replace(/\s/g, "").toLowerCase();
    request.email = this.email.trim().toLowerCase();
    const key = await this.loginStrategyService.makePreloginKey(this.masterPassword, request.email);
    request.masterPasswordHash = await this.keyService.hashMasterKey(this.masterPassword, key);

    try {
      await this.apiService.postTwoFactorRecover(request);

      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("twoStepRecoverDisabled"),
      });

      if (!this.recoveryCodeLoginFeatureFlagEnabled) {
        await this.router.navigate(["/"]);
        return;
      }

      // Handle login after recovery if the feature flag is enabled
      await this.handleRecoveryLogin(request);
    } catch (e) {
      // Using the extracted error message helper to simplify error handling
      const errorMessage = this.extractErrorMessage(e);
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("error"),
        message: errorMessage,
      });
    }
  }

  /**
   * Handles the login process after a successful account recovery.
   */
  private async handleRecoveryLogin(request: TwoFactorRecoveryRequest) {
    const twoFactorRequest: TokenTwoFactorRequest = {
      provider: TwoFactorProviderType.RecoveryCode,
      token: request.recoveryCode,
      remember: false,
    };

    const credentials = new PasswordLoginCredentials(
      request.email,
      this.masterPassword,
      null,
      twoFactorRequest,
    );

    try {
      await this.loginStrategyService.logIn(credentials);
      this.toastService.showToast({
        variant: "success",
        title: null,
        message: this.i18nService.t("youHaveBeenLoggedIn"),
      });
      await this.router.navigate(["/settings/security/two-factor"]);
    } catch (error) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("unexpectedError"),
        message: error?.message,
      });
      // Redirect to login page if there are errors during login
      await this.router.navigate(["/login"], { queryParams: { email: request.email } });
    }
  }

  /**
   * Extracts an error message from the error object.
   */
  private extractErrorMessage(error: any): string {
    let errorMessage: string = this.i18nService.t("unexpectedError");
    if (error?.validationErrors && typeof error.validationErrors === "object") {
      errorMessage = Object.keys(error.validationErrors)
        .map((key) => {
          const messages = error.validationErrors[key];
          return Array.isArray(messages) ? messages.join(" ") : messages;
        })
        .join(" ");
    } else if (error?.message) {
      errorMessage = error.message;
    }
    return errorMessage;
  }
}
