import { Component, DestroyRef, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import {
  LoginStrategyServiceAbstraction,
  PasswordLoginCredentials,
  LoginSuccessHandlerService,
} from "@bitwarden/auth/common";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { ToastService } from "@bitwarden/components";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-recover-two-factor",
  templateUrl: "recover-two-factor.component.html",
  standalone: false,
})
export class RecoverTwoFactorComponent implements OnInit {
  formGroup = new FormGroup({
    email: new FormControl("", [Validators.required]),
    masterPassword: new FormControl("", [Validators.required]),
    recoveryCode: new FormControl("", [Validators.required]),
  });

  /**
   * Message to display to the user about the recovery code
   */
  recoveryCodeMessage = "";

  constructor(
    private destroyRef: DestroyRef,
    private router: Router,
    private i18nService: I18nService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private toastService: ToastService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private logService: LogService,
    private validationService: ValidationService,
  ) {}

  async ngOnInit() {
    this.recoveryCodeMessage = this.i18nService.t("logInBelowUsingYourSingleUseRecoveryCode");

    // Clear any existing recovery code inline error when user updates the form
    this.formGroup.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.formGroup.get("recoveryCode")?.setErrors(null);
    });
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

    const email = this.email.trim().toLowerCase();
    const recoveryCode = this.recoveryCode.replace(/\s/g, "").toLowerCase();

    await this.loginWithRecoveryCode(email, recoveryCode);
  };

  /**
   * Handles the login process after a successful account recovery.
   */
  private async loginWithRecoveryCode(email: string, recoveryCode: string) {
    // Build two-factor request to pass into PasswordLoginCredentials request using the 2FA recovery code and RecoveryCode type
    const twoFactorRequest: TokenTwoFactorRequest = {
      provider: TwoFactorProviderType.RecoveryCode,
      token: recoveryCode,
      remember: false,
    };

    const credentials = new PasswordLoginCredentials(email, this.masterPassword, twoFactorRequest);

    try {
      const authResult = await this.loginStrategyService.logIn(credentials);
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("youHaveBeenLoggedIn"),
      });
      this.toastService.showToast({
        variant: "success",
        title: "",
        message: this.i18nService.t("twoStepRecoverDisabled"),
      });

      await this.loginSuccessHandlerService.run(authResult.userId);

      await this.router.navigate(["/settings/security/two-factor"]);
    } catch (error: unknown) {
      if (error instanceof ErrorResponse) {
        if (
          error.message.includes(
            "Two-factor recovery has been performed. SSO authentication is required.",
          )
        ) {
          // [PM-21153]: Organization users with as SSO requirement need to be able to recover 2FA,
          //  but still be bound by the SSO requirement to log in. Therefore, we show a success toast for recovering 2FA,
          //  but then inform them that they need to log in via SSO and redirect them to the login page.
          // The response tested here is a specific message for this scenario from request validation.
          this.toastService.showToast({
            variant: "success",
            title: "",
            message: this.i18nService.t("twoStepRecoverDisabled"),
          });
          this.toastService.showToast({
            variant: "error",
            title: "",
            message: this.i18nService.t("ssoLoginIsRequired"),
          });

          await this.router.navigate(["/login"]);
        } else {
          this.logService.error("Error logging in automatically: ", error.message);

          if (error.message.includes("Two-step token is invalid")) {
            this.formGroup.get("recoveryCode")?.setErrors({
              invalidRecoveryCode: { message: this.i18nService.t("invalidRecoveryCode") },
            });
          } else {
            this.validationService.showError(error.message);
          }
        }
      } else {
        this.logService.error("Error logging in automatically: ", error);
        this.validationService.showError(error);
      }
    }
  }
}
