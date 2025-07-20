import { Component, OnInit } from "@angular/core";
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { Router } from "@angular/router";

import {
  LoginStrategyServiceAbstraction,
  PasswordLoginCredentials,
  LoginSuccessHandlerService,
} from "@bitwarden/auth/common";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { ToastService } from "@bitwarden/components";

@Component({
  selector: "app-recover-two-factor",
  templateUrl: "recover-two-factor.component.html",
  standalone: false,
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

  constructor(
    private router: Router,
    private i18nService: I18nService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private toastService: ToastService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private logService: LogService,
  ) {}

  async ngOnInit() {
    this.recoveryCodeMessage = this.i18nService.t("logInBelowUsingYourSingleUseRecoveryCode");
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
    } catch (error) {
      // If login errors, redirect to login page per product. Don't show error
      this.logService.error("Error logging in automatically: ", (error as Error).message);
      await this.router.navigate(["/login"], { queryParams: { email: email } });
    }
  }
}
