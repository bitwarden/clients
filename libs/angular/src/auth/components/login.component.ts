import { Directive, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { Subject, firstValueFrom } from "rxjs";
import { take, takeUntil } from "rxjs/operators";

import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { WebAuthnLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/webauthn/webauthn-login.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import {
  AllValidationErrors,
  FormValidationErrorsService,
} from "../../platform/abstractions/form-validation-errors.service";

import { CaptchaProtectedComponent } from "./captcha-protected.component";

@Directive()
export class LoginComponent extends CaptchaProtectedComponent implements OnInit, OnDestroy {
  @ViewChild("masterPasswordInput", { static: true }) masterPasswordInput: ElementRef;

  showPassword = false;
  formPromise: Promise<AuthResult>;
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;
  onSuccessfulLoginForceResetNavigate: () => Promise<any>;
  showLoginWithDevice: boolean;
  validatedEmail = false;
  paramEmailSet = false;

  get emailFormControl() {
    return this.formGroup.controls.email;
  }

  formGroup = this.formBuilder.group({
    email: ["", [Validators.required, Validators.email]],
    masterPassword: [
      "",
      [Validators.required, Validators.minLength(Utils.originalMinimumPasswordLength)],
    ],
    rememberEmail: [false],
  });

  protected twoFactorRoute = "2fa";
  protected successRoute = "vault";
  // TODO: remove when email verification flag is removed
  protected registerRoute = "/register";
  protected forcePasswordResetRoute = "update-temp-password";

  protected destroy$ = new Subject<void>();

  get loggedEmail() {
    return this.formGroup.value.email;
  }

  constructor(
    protected devicesApiService: DevicesApiServiceAbstraction,
    protected appIdService: AppIdService,
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected router: Router,
    platformUtilsService: PlatformUtilsService,
    i18nService: I18nService,
    protected stateService: StateService,
    environmentService: EnvironmentService,
    protected passwordGenerationService: PasswordGenerationServiceAbstraction,
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected ngZone: NgZone,
    protected formBuilder: FormBuilder,
    protected formValidationErrorService: FormValidationErrorsService,
    protected route: ActivatedRoute,
    protected loginEmailService: LoginEmailServiceAbstraction,
    protected ssoLoginService: SsoLoginServiceAbstraction,
    protected webAuthnLoginService: WebAuthnLoginServiceAbstraction,
    protected configService: ConfigService,
  ) {
    super(environmentService, i18nService, platformUtilsService);
  }

  async ngOnInit() {
    // TODO: remove when email verification flag is removed
    const emailVerification = await this.configService.getFeatureFlag(
      FeatureFlag.EmailVerification,
    );

    if (emailVerification) {
      this.registerRoute = "/signup";
    }

    this.route?.queryParams.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      if (!params) {
        return;
      }

      const queryParamsEmail = params.email;

      if (queryParamsEmail != null && queryParamsEmail.indexOf("@") > -1) {
        this.formGroup.controls.email.setValue(queryParamsEmail);
        this.paramEmailSet = true;
      }
    });

    if (!this.paramEmailSet) {
      const storedEmail = await firstValueFrom(this.loginEmailService.storedEmail$);
      this.formGroup.controls.email.setValue(storedEmail ?? "");
    }

    let rememberEmail = this.loginEmailService.getRememberEmail();

    if (!rememberEmail) {
      rememberEmail = (await firstValueFrom(this.loginEmailService.storedEmail$)) != null;
    }

    this.formGroup.controls.rememberEmail.setValue(rememberEmail);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async submit(showToast = true) {
    const data = this.formGroup.value;

    await this.setupCaptcha();

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
      const credentials = new PasswordLoginCredentials(
        data.email,
        data.masterPassword,
        this.captchaToken,
        null,
      );

      this.formPromise = this.loginStrategyService.logIn(credentials);
      const response = await this.formPromise;

      this.setLoginEmailValues();
      await this.loginEmailService.saveEmailSettings();

      if (this.handleCaptchaRequired(response)) {
        return;
      } else if (await this.handleMigrateEncryptionKey(response)) {
        return;
      } else if (response.requiresTwoFactor) {
        if (this.onSuccessfulLoginTwoFactorNavigate != null) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onSuccessfulLoginTwoFactorNavigate();
        } else {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate([this.twoFactorRoute]);
        }
      } else if (response.forcePasswordReset != ForceSetPasswordReason.None) {
        if (this.onSuccessfulLoginForceResetNavigate != null) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onSuccessfulLoginForceResetNavigate();
        } else {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate([this.forcePasswordResetRoute]);
        }
      } else {
        if (this.onSuccessfulLogin != null) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onSuccessfulLogin();
        }
        if (this.onSuccessfulLoginNavigate != null) {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.onSuccessfulLoginNavigate();
        } else {
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.router.navigate([this.successRoute]);
        }
      }
    } catch (e) {
      this.logService.error(e);
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

  async startAuthRequestLogin() {
    this.formGroup.get("masterPassword")?.clearValidators();
    this.formGroup.get("masterPassword")?.updateValueAndValidity();

    if (!this.formGroup.valid) {
      return;
    }

    this.setLoginEmailValues();
    await this.router.navigate(["/login-with-device"]);
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
    await this.ssoLoginService.setSsoState(state);
    await this.ssoLoginService.setCodeVerifier(ssoCodeVerifier);

    // Build URI
    const env = await firstValueFrom(this.environmentService.environment$);
    const webUrl = env.getWebVaultUrl();

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
        codeChallenge +
        "&email=" +
        encodeURIComponent(this.formGroup.controls.email.value),
    );
  }

  async validateEmail() {
    this.formGroup.controls.email.markAsTouched();
    const emailValid = this.formGroup.get("email").valid;
    if (emailValid) {
      this.toggleValidateEmail(true);
      await this.getLoginWithDevice(this.loggedEmail);
    }
  }

  toggleValidateEmail(value: boolean) {
    this.validatedEmail = value;
    if (!this.validatedEmail) {
      // Reset master password only when going from validated to not validated
      // so that autofill can work properly
      this.formGroup.controls.masterPassword.reset();
    } else {
      // Mark MP as untouched so that, when users enter email and hit enter,
      // the MP field doesn't load with validation errors
      this.formGroup.controls.masterPassword.markAsUntouched();

      // When email is validated, focus on master password after
      // waiting for input to be rendered
      if (this.ngZone.isStable) {
        this.masterPasswordInput?.nativeElement?.focus();
      } else {
        this.ngZone.onStable.pipe(take(1)).subscribe(() => {
          this.masterPasswordInput?.nativeElement?.focus();
        });
      }
    }
  }

  setLoginEmailValues() {
    this.loginEmailService.setEmail(this.formGroup.value.email);
    this.loginEmailService.setRememberEmail(this.formGroup.value.rememberEmail);
  }

  async saveEmailSettings() {
    this.setLoginEmailValues();
    await this.loginEmailService.saveEmailSettings();

    // Save off email for SSO
    await this.ssoLoginService.setSsoEmail(this.formGroup.value.email);
  }

  // Legacy accounts used the master key to encrypt data. Migration is required
  // but only performed on web
  protected async handleMigrateEncryptionKey(result: AuthResult): Promise<boolean> {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }

    this.platformUtilsService.showToast(
      "error",
      this.i18nService.t("errorOccured"),
      this.i18nService.t("encryptionKeyMigrationRequired"),
    );
    return true;
  }

  private getErrorToastMessage() {
    const error: AllValidationErrors = this.formValidationErrorService
      .getFormValidationErrors(this.formGroup.controls)
      .shift();

    if (error) {
      switch (error.errorName) {
        case "email":
          return this.i18nService.t("invalidEmail");
        case "minlength":
          return this.i18nService.t("masterPasswordMinlength", Utils.originalMinimumPasswordLength);
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

  async getLoginWithDevice(email: string) {
    try {
      const deviceIdentifier = await this.appIdService.getAppId();
      this.showLoginWithDevice = await this.devicesApiService.getKnownDevice(
        email,
        deviceIdentifier,
      );
    } catch (e) {
      this.showLoginWithDevice = false;
    }
  }
}
