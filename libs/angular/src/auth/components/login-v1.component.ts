// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, Validators } from "@angular/forms";
import { ActivatedRoute, NavigationSkipped, Router } from "@angular/router";
import { Subject, firstValueFrom, of } from "rxjs";
import { switchMap, take, takeUntil } from "rxjs/operators";

import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import {
  AllValidationErrors,
  FormValidationErrorsService,
} from "../../platform/abstractions/form-validation-errors.service";

import { CaptchaProtectedComponent } from "./captcha-protected.component";

@Directive()
export class LoginComponentV1 extends CaptchaProtectedComponent implements OnInit, OnDestroy {
  @ViewChild("masterPasswordInput", { static: true }) masterPasswordInput: ElementRef;

  showPassword = false;
  formPromise: Promise<AuthResult>;

  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: (userId: UserId) => Promise<any>;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;
  onSuccessfulLoginForceResetNavigate: () => Promise<any>;

  showLoginWithDevice: boolean;
  validatedEmail = false;
  paramEmailSet = false;

  get emailFormControl() {
    return this.formGroup.controls.email;
  }

  formGroup = this.formBuilder.nonNullable.group({
    email: ["", [Validators.required, Validators.email]],
    masterPassword: [
      "",
      [Validators.required, Validators.minLength(Utils.originalMinimumPasswordLength)],
    ],
    rememberEmail: [false],
  });

  protected twoFactorRoute = "2fa";
  protected successRoute = "vault";
  protected forcePasswordResetRoute = "update-temp-password";

  protected destroy$ = new Subject<void>();

  get loggedEmail() {
    return this.formGroup.controls.email.value;
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
    protected toastService: ToastService,
  ) {
    super(environmentService, i18nService, platformUtilsService, toastService);
  }

  async ngOnInit() {
    this.route?.queryParams
      .pipe(
        switchMap((params) => {
          if (!params) {
            // If no params,loadEmailSettings from state
            return this.loadEmailSettings();
          }

          const queryParamsEmail = params.email;

          if (queryParamsEmail != null && queryParamsEmail.indexOf("@") > -1) {
            this.formGroup.controls.email.setValue(queryParamsEmail);
            this.paramEmailSet = true;
          }

          // If paramEmailSet is false, loadEmailSettings from state
          return this.paramEmailSet ? of(null) : this.loadEmailSettings();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // If the user navigates to /login from /login, reset the validatedEmail flag
    // This should bring the user back to the login screen with the email field
    this.router.events.pipe(takeUntil(this.destroy$)).subscribe((event) => {
      if (event instanceof NavigationSkipped && event.url === "/login") {
        this.validatedEmail = false;
      }
    });

    // Backup check to handle unknown case where activatedRoute is not available
    // This shouldn't happen under normal circumstances
    if (!this.route) {
      await this.loadEmailSettings();
    }
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async submit(showToast = true) {
    await this.setupCaptcha();

    this.formGroup.markAllAsTouched();

    //web
    if (this.formGroup.invalid && !showToast) {
      return;
    }

    //desktop, browser; This should be removed once all clients use reactive forms
    if (this.formGroup.invalid && showToast) {
      const errorText = this.getErrorToastMessage();
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: errorText,
      });
      return;
    }

    try {
      const credentials = new PasswordLoginCredentials(
        this.formGroup.controls.email.value,
        this.formGroup.controls.masterPassword.value,
        this.captchaToken,
        undefined,
      );

      this.formPromise = this.loginStrategyService.logIn(credentials);
      const response = await this.formPromise;

      await this.saveEmailSettings();

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
          this.loginEmailService.clearValues();
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
          this.onSuccessfulLoginNavigate(response.userId);
        } else {
          this.loginEmailService.clearValues();
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

    await this.saveEmailSettings();
    await this.router.navigate(["/login-with-device"]);
  }

  async launchSsoBrowser(clientId: string, ssoRedirectUri: string) {
    // Save off email for SSO
    await this.ssoLoginService.setSsoEmail(this.formGroup.value.email);

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

  private async loadEmailSettings() {
    // Try to load from memory first
    const email = await firstValueFrom(this.loginEmailService.loginEmail$);
    const rememberEmail = this.loginEmailService.getRememberEmail();

    if (email) {
      this.formGroup.controls.email.setValue(email);
      this.formGroup.controls.rememberEmail.setValue(rememberEmail);
    } else {
      // If not in memory, check email on disk
      const storedEmail = await firstValueFrom(this.loginEmailService.storedEmail$);
      if (storedEmail) {
        // If we have a stored email, rememberEmail should default to true
        this.formGroup.controls.email.setValue(storedEmail);
        this.formGroup.controls.rememberEmail.setValue(true);
      }
    }
  }

  protected async saveEmailSettings() {
    // Save off email for SSO
    await this.ssoLoginService.setSsoEmail(this.formGroup.value.email);

    this.loginEmailService.setLoginEmail(this.formGroup.value.email);
    this.loginEmailService.setRememberEmail(this.formGroup.value.rememberEmail);
    await this.loginEmailService.saveEmailSettings();
  }

  // Legacy accounts used the master key to encrypt data. Migration is required but only performed on web
  protected async handleMigrateEncryptionKey(result: AuthResult): Promise<boolean> {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }

    this.toastService.showToast({
      variant: "error",
      title: this.i18nService.t("errorOccured"),
      message: this.i18nService.t("encryptionKeyMigrationRequired"),
    });
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
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.showLoginWithDevice = false;
    }
  }
}
