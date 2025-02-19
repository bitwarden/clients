import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import {
  LoginStrategyServiceAbstraction,
  PasswordLoginCredentials,
  LoginSuccessHandlerService,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { TwoFactorRecoveryRequest } from "@bitwarden/common/auth/models/request/two-factor-recovery.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ToastService } from "@bitwarden/components";
import { KeyService } from "@bitwarden/key-management";

@Component({
  selector: "app-recover-two-factor",
  templateUrl: "recover-two-factor.component.html",
})
export class RecoverTwoFactorComponent implements OnInit {
  protected formGroup = new FormGroup({
    email: new FormControl("", [Validators.required]),
    masterPassword: new FormControl("", [Validators.required]),
    recoveryCode: new FormControl("", [Validators.required]),
  });

  /**
   * Message to display to the user about the recovery code
   */
  recoveryCodeMessage = "";

  /**
   * Whether the recovery code login feature flag is enabled
   */
  private recoveryCodeLoginFeatureFlagEnabled = false;

  constructor(
    private router: Router,
    private apiService: ApiService,
    private platformUtilsService: PlatformUtilsService,
    private i18nService: I18nService,
    private keyService: KeyService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private toastService: ToastService,
    private configService: ConfigService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private logService: LogService,
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
    return this.formGroup.get("email")?.value ?? "";
  }

  get masterPassword(): string {
    return this.formGroup.get("masterPassword")?.value ?? "";
  }

  get recoveryCode(): string {
    return this.formGroup.get("recoveryCode")?.value ?? "";
  }

  /**
   * Handles the submission of the recovery code form.
   */
  submit = async () => {
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
        title: "",
        message: this.i18nService.t("twoStepRecoverDisabled"),
      });

      if (!this.recoveryCodeLoginFeatureFlagEnabled) {
        await this.router.navigate(["/"]);
        return;
      }

      // Handle login after recovery if the feature flag is enabled
      await this.handleRecoveryLogin(request);
    } catch (e) {
      const errorMessage = this.extractErrorMessage(e);
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("error"),
        message: errorMessage,
      });
    }
  };

  /**
   * Handles the login process after a successful account recovery.
   */
  private async handleRecoveryLogin(request: TwoFactorRecoveryRequest) {
    // Build two-factor request to pass into PasswordLoginCredentials request using the 2FA recovery code and RecoveryCode type
    const twoFactorRequest: TokenTwoFactorRequest = {
      provider: TwoFactorProviderType.RecoveryCode,
      token: request.recoveryCode,
      remember: false,
    };

    const credentials = new PasswordLoginCredentials(
      request.email,
      this.masterPassword,
      "",
      twoFactorRequest,
    );

    try {
      const authResult = await this.loginStrategyService.logIn(credentials);
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("youHaveBeenLoggedIn"),
      });
      await this.loginSuccessHandlerService.run(authResult.userId);
      await this.router.navigate(["/settings/security/two-factor"]);
    } catch (error) {
      // If login errors, redirect to login page per product. Don't show error
      this.logService.error("Error logging in automatically: ", (error as Error).message);
      await this.router.navigate(["/login"], { queryParams: { email: request.email } });
    }
  }

  /**
   * Extracts an error message from the error object.
   */
  private extractErrorMessage(error: unknown): string {
    let errorMessage: string = this.i18nService.t("unexpectedError");
    if (error && typeof error === "object" && "validationErrors" in error) {
      const validationErrors = error.validationErrors;
      if (validationErrors && typeof validationErrors === "object") {
        errorMessage = Object.keys(validationErrors)
          .map((key) => {
            const messages = (validationErrors as Record<string, string | string[]>)[key];
            return Array.isArray(messages) ? messages.join(" ") : messages;
          })
          .join(" ");
      }
    } else if (
      error &&
      typeof error === "object" &&
      "message" in error &&
      typeof error.message === "string"
    ) {
      errorMessage = error.message;
    }
    return errorMessage;
  }
}
