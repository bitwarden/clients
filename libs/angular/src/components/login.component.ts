import { Directive, NgZone, OnInit } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { take } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AppIdService } from "@bitwarden/common/abstractions/appId.service";
import { AuthService } from "@bitwarden/common/abstractions/auth.service";
import { CryptoFunctionService } from "@bitwarden/common/abstractions/cryptoFunction.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import {
  AllValidationErrors,
  FormValidationErrorsService,
} from "@bitwarden/common/abstractions/formValidationErrors.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { LoginService } from "@bitwarden/common/abstractions/login.service";
import { PasswordGenerationService } from "@bitwarden/common/abstractions/passwordGeneration.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { Utils } from "@bitwarden/common/misc/utils";
import { AuthResult } from "@bitwarden/common/models/domain/auth-result";
import { PasswordLogInCredentials } from "@bitwarden/common/models/domain/log-in-credentials";

@Directive()
export class LoginComponent implements OnInit {
  showPassword = false;
  formPromise: Promise<AuthResult>;
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;
  onSuccessfulLoginForceResetNavigate: () => Promise<any>;
  private selfHosted = false;
  showLoginWithDevice: boolean;
  validatedEmail = false;
  paramEmailSet = false;

  protected captchaSiteKey?: string;
  protected captchaToken?: string;

  formGroup = this.formBuilder.group({
    email: ["", [Validators.required, Validators.email]],
    masterPassword: ["", [Validators.required, Validators.minLength(8)]],
    rememberEmail: [false],
  });

  protected twoFactorRoute = "2fa";
  protected successRoute = "vault";
  protected forcePasswordResetRoute = "update-temp-password";

  get loggedEmail() {
    return this.formGroup.value.email;
  }

  constructor(
    protected apiService: ApiService,
    protected appIdService: AppIdService,
    protected authService: AuthService,
    protected router: Router,
    protected platformUtilsService: PlatformUtilsService,
    protected i18nService: I18nService,
    protected stateService: StateService,
    protected environmentService: EnvironmentService,
    protected passwordGenerationService: PasswordGenerationService,
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected ngZone: NgZone,
    protected formBuilder: FormBuilder,
    protected formValidationErrorService: FormValidationErrorsService,
    protected route: ActivatedRoute,
    protected loginService: LoginService
  ) {
    this.selfHosted = platformUtilsService.isSelfHost();
  }

  get selfHostedDomain() {
    return this.environmentService.hasBaseUrl() ? this.environmentService.getWebVaultUrl() : null;
  }

  async ngOnInit() {
    this.route?.queryParams.subscribe((params) => {
      if (params != null) {
        const queryParamsEmail = params["email"];
        if (queryParamsEmail != null && queryParamsEmail.indexOf("@") > -1) {
          this.formGroup.get("email").setValue(queryParamsEmail);
          this.loginService.setEmail(queryParamsEmail);
          this.paramEmailSet = true;
        }
      }
    });
    let email = this.loginService.getEmail();

    if (email == null || email === "") {
      email = await this.stateService.getRememberedEmail();
    }

    if (!this.paramEmailSet) {
      this.formGroup.get("email")?.setValue(email ?? "");
    }
    let rememberEmail = this.loginService.getRememberEmail();
    if (rememberEmail == null) {
      rememberEmail = (await this.stateService.getRememberedEmail()) != null;
    }
    this.formGroup.get("rememberEmail")?.setValue(rememberEmail);
  }

  async submit(showToast = true) {
    const data = this.formGroup.value;

    this.formGroup.markAllAsTouched();

    //web
    if (this.formGroup.invalid && !showToast) {
      return;
    }

    //desktop, browser; This should be removed once all clients use reactive forms
    if (this.formGroup.invalid && showToast) {
      const errorText = this.getErrorToastMessage();
      this.platformUtilsService.showToast("error", this.i18nService.t("errorOccurred"), errorText);
      return;
    }

    try {
      const credentials = new PasswordLogInCredentials(
        data.email,
        data.masterPassword,
        this.captchaToken,
        null
      );
      this.formPromise = this.authService.logIn(credentials);
      const response = await this.formPromise;
      this.setFormValues();
      await this.loginService.saveEmailSettings();
      if (!Utils.isNullOrWhitespace(response.captchaSiteKey)) {
        this.captchaSiteKey = response.captchaSiteKey;
        return;
      } else if (response.requiresTwoFactor) {
        if (this.onSuccessfulLoginTwoFactorNavigate != null) {
          this.onSuccessfulLoginTwoFactorNavigate();
        } else {
          this.router.navigate([this.twoFactorRoute]);
        }
      } else if (response.forcePasswordReset) {
        if (this.onSuccessfulLoginForceResetNavigate != null) {
          this.onSuccessfulLoginForceResetNavigate();
        } else {
          this.router.navigate([this.forcePasswordResetRoute]);
        }
      } else {
        const disableFavicon = await this.stateService.getDisableFavicon();
        await this.stateService.setDisableFavicon(!!disableFavicon);
        if (this.onSuccessfulLogin != null) {
          this.onSuccessfulLogin();
        }
        if (this.onSuccessfulLoginNavigate != null) {
          this.onSuccessfulLoginNavigate();
        } else {
          this.router.navigate([this.successRoute]);
        }
      }
    } catch (e) {
      this.logService.error(e);

      // Invalidate the captcha
      this.captchaToken = undefined;
    }
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
    if (this.ngZone.isStable) {
      document.getElementById("masterPassword").focus();
    } else {
      this.ngZone.onStable
        .pipe(take(1))
        .subscribe(() => document.getElementById("masterPassword").focus());
    }
  }

  async launchSsoBrowser(clientId: string, ssoRedirectUri: string) {
    await this.saveEmailSettings();
    // Generate necessary sso params
    const passwordOptions: any = {
      type: "password",
      length: 64,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: false,
    };
    const state = await this.passwordGenerationService.generatePassword(passwordOptions);
    const ssoCodeVerifier = await this.passwordGenerationService.generatePassword(passwordOptions);
    const codeVerifierHash = await this.cryptoFunctionService.hash(ssoCodeVerifier, "sha256");
    const codeChallenge = Utils.fromBufferToUrlB64(codeVerifierHash);

    // Save sso params
    await this.stateService.setSsoState(state);
    await this.stateService.setSsoCodeVerifier(ssoCodeVerifier);

    // Build URI
    const webUrl = this.environmentService.getWebVaultUrl();

    // Launch browser
    this.platformUtilsService.launchUri(
      webUrl +
        "/#/sso?clientId=" +
        clientId +
        "&redirectUri=" +
        encodeURIComponent(ssoRedirectUri) +
        "&state=" +
        state +
        "&codeChallenge=" +
        codeChallenge
    );
  }

  async validateEmail() {
    this.formGroup.controls.email.markAsTouched();
    const emailInvalid = this.formGroup.get("email").invalid;
    if (!emailInvalid) {
      this.toggleValidateEmail(true);
      await this.getLoginWithDevice(this.loggedEmail);
    }
  }

  toggleValidateEmail(value: boolean) {
    this.validatedEmail = value;
    this.formGroup.controls.masterPassword.reset();
  }

  setFormValues() {
    this.loginService.setEmail(this.formGroup.value.email);
    this.loginService.setRememberEmail(this.formGroup.value.rememberEmail);
  }

  async saveEmailSettings() {
    this.setFormValues();
    await this.loginService.saveEmailSettings();
  }

  private getErrorToastMessage() {
    const error: AllValidationErrors = this.formValidationErrorService
      .getFormValidationErrors(this.formGroup.controls)
      .shift();

    if (error) {
      switch (error.errorName) {
        case "email":
          return this.i18nService.t("invalidEmail");
        default:
          return this.i18nService.t(this.errorTag(error));
      }
    }

    return;
  }

  private errorTag(error: AllValidationErrors): string {
    const name = error.errorName.charAt(0).toUpperCase() + error.errorName.slice(1);
    return `${error.controlName}${name}`;
  }

  private async getLoginWithDevice(email: string) {
    try {
      const deviceIdentifier = await this.appIdService.getAppId();
      const res = await this.apiService.getKnownDevice(email, deviceIdentifier);
      //ensure the application is not self-hosted
      this.showLoginWithDevice = res && !this.selfHosted;
    } catch (e) {
      this.showLoginWithDevice = false;
    }
  }

  protected setCaptchaToken(token: string) {
    this.captchaToken = token;
    this.submit();
  }
}
