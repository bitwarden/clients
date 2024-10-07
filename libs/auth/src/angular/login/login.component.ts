import { CommonModule } from "@angular/common";
import { Component, ElementRef, Input, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { first, firstValueFrom, of, Subject, switchMap, take, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  LoginEmailServiceAbstraction,
  LoginStrategyServiceAbstraction,
  PasswordLoginCredentials,
  RegisterRouteService,
} from "@bitwarden/auth/common";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyData } from "@bitwarden/common/admin-console/models/data/policy.data";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { CaptchaIFrame } from "@bitwarden/common/auth/captcha-iframe";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { ClientType } from "@bitwarden/common/enums";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  ToastService,
} from "@bitwarden/components";

import { AnonLayoutWrapperDataService } from "../anon-layout/anon-layout-wrapper-data.service";
import { WaveIcon } from "../icons";

import { LoginComponentService } from "./login-component.service";

const BroadcasterSubscriptionId = "LoginComponent";

export enum LoginUiState {
  EMAIL_ENTRY = "EmailEntry",
  MASTER_PASSWORD_ENTRY = "MasterPasswordEntry",
}

@Component({
  standalone: true,
  templateUrl: "./login.component.html",
  imports: [
    AsyncActionsModule,
    ButtonModule,
    CheckboxModule,
    CommonModule,
    FormFieldModule,
    IconButtonModule,
    JslibModule,
    ReactiveFormsModule,
    RouterModule,
  ],
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild("masterPasswordInputRef") masterPasswordInputRef: ElementRef;
  @Input() captchaSiteKey: string = null;

  private destroy$ = new Subject<void>();
  readonly Icons = { WaveIcon };

  captcha: CaptchaIFrame;
  captchaToken: string = null;
  clientType: ClientType;
  ClientType = ClientType;
  LoginUiState = LoginUiState;
  registerRoute$ = this.registerRouteService.registerRoute$(); // TODO: remove when email verification flag is removed
  isKnownDevice = false;
  validatedEmail = false;

  formGroup = this.formBuilder.group(
    {
      email: ["", [Validators.required, Validators.email]],
      masterPassword: [
        "",
        [Validators.required, Validators.minLength(Utils.originalMinimumPasswordLength)],
      ],
      rememberEmail: [false],
    },
    { updateOn: "submit" },
  );

  get emailFormControl(): FormControl<string> {
    return this.formGroup.controls.email;
  }

  get loggedEmail(): string {
    return this.formGroup.value.email;
  }

  get uiState(): LoginUiState {
    return this.validatedEmail ? LoginUiState.MASTER_PASSWORD_ENTRY : LoginUiState.EMAIL_ENTRY;
  }

  // Web properties
  enforcedPasswordPolicyOptions: MasterPasswordPolicyOptions;
  policies: Policy[];
  loginViaAuthRequestSupported = false;
  showResetPasswordAutoEnrollWarning = false;

  // Desktop properties
  deferFocus: boolean | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private appIdService: AppIdService,
    private broadcasterService: BroadcasterService,
    private devicesApiService: DevicesApiServiceAbstraction,
    private environmentService: EnvironmentService,
    private formBuilder: FormBuilder,
    private i18nService: I18nService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private loginComponentService: LoginComponentService,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private messagingService: MessagingService,
    private ngZone: NgZone,
    private passwordStrengthService: PasswordStrengthServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private policyService: InternalPolicyService,
    private registerRouteService: RegisterRouteService,
    private router: Router,
    private syncService: SyncService,
    private toastService: ToastService,
  ) {
    this.clientType = this.platformUtilsService.getClientType();
    this.loginViaAuthRequestSupported = this.loginComponentService.isLoginViaAuthRequestSupported();
  }

  async ngOnInit(): Promise<void> {
    if (this.clientType === ClientType.Web) {
      await this.webOnInit();
    }

    await this.defaultOnInit();

    if (this.clientType === ClientType.Browser) {
      if (this.loginViaAuthRequestSupported) {
        await this.validateEmail();
      }
    }

    if (this.clientType === ClientType.Desktop) {
      await this.desktopOnInit();
    }
  }

  ngOnDestroy(): void {
    if (this.clientType === ClientType.Desktop) {
      // TODO: refactor to not use deprecated broadcaster service.
      this.broadcasterService.unsubscribe(BroadcasterSubscriptionId);
    }

    this.destroy$.next();
    this.destroy$.complete();
  }

  submit = async (): Promise<void> => {
    if (this.clientType === ClientType.Desktop) {
      if (!this.validatedEmail) {
        return;
      }
    }

    const { email, masterPassword } = this.formGroup.value;

    await this.setupCaptcha();

    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const credentials = new PasswordLoginCredentials(
      email,
      masterPassword,
      this.captchaToken,
      null,
    );

    const authResult = await this.loginStrategyService.logIn(credentials);

    await this.saveEmailSettings();
    await this.handleAuthResult(authResult);

    if (this.clientType === ClientType.Desktop) {
      if (this.captchaSiteKey) {
        const content = document.getElementById("content") as HTMLDivElement;
        content.setAttribute("style", "width:335px");
      }
    }
  };

  /**
   * Handles the result of the authentication process.
   *
   * @param authResult
   * @returns A simple `return` statement for each conditional check.
   *          If you update this method, do not forget to add a `return`
   *          to each if-condition block where necessary to stop code execution.
   */
  private async handleAuthResult(authResult: AuthResult): Promise<void> {
    if (this.handleCaptchaRequired(authResult)) {
      this.captchaSiteKey = authResult.captchaSiteKey;
      this.captcha.init(authResult.captchaSiteKey);
      return;
    }

    if (authResult.requiresEncryptionKeyMigration) {
      /* Legacy accounts used the master key to encrypt data.
         Migration is required but only performed on Web. */
      if (this.clientType === ClientType.Web) {
        await this.router.navigate(["migrate-legacy-encryption"]);
      } else {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccured"),
          message: this.i18nService.t("encryptionKeyMigrationRequired"),
        });
      }
      return;
    }

    if (authResult.requiresTwoFactor) {
      await this.router.navigate(["2fa"]);
      return;
    }

    await this.syncService.fullSync(true);

    if (authResult.forcePasswordReset != ForceSetPasswordReason.None) {
      this.loginEmailService.clearValues();
      await this.router.navigate(["update-temp-password"]);
      return;
    }

    // If none of the above cases are true, proceed with login...
    // ...on Web
    if (this.clientType === ClientType.Web) {
      await this.goAfterLogIn(authResult.userId);
      // ...on Browser/Desktop
    } else if (this.clientType === ClientType.Browser) {
      this.loginEmailService.clearValues();
      await this.router.navigate(["/tabs/vault"]);
    } else {
      await this.router.navigate(["vault"]);
      this.loginEmailService.clearValues();
    }
  }

  protected async launchSsoBrowserWindow(clientId: "browser" | "desktop"): Promise<void> {
    await this.loginComponentService.launchSsoBrowserWindow(this.loggedEmail, clientId);
  }

  protected async goAfterLogIn(userId: UserId): Promise<void> {
    const masterPassword = this.formGroup.value.masterPassword;

    // Check master password against policy
    if (this.enforcedPasswordPolicyOptions != null) {
      const strengthResult = this.passwordStrengthService.getPasswordStrength(
        masterPassword,
        this.formGroup.value.email,
      );
      const masterPasswordScore = strengthResult == null ? null : strengthResult.score;

      // If invalid, save policies and require update
      if (
        !this.policyService.evaluateMasterPassword(
          masterPasswordScore,
          masterPassword,
          this.enforcedPasswordPolicyOptions,
        )
      ) {
        const policiesData: { [id: string]: PolicyData } = {};
        this.policies.map((p) => (policiesData[p.id] = PolicyData.fromPolicy(p)));
        await this.policyService.replace(policiesData, userId);
        await this.router.navigate(["update-password"]);
        return;
      }
    }
  }

  protected showCaptcha(): boolean {
    return !Utils.isNullOrWhitespace(this.captchaSiteKey);
  }

  protected async startAuthRequestLogin(): Promise<void> {
    this.formGroup.get("masterPassword")?.clearValidators();
    this.formGroup.get("masterPassword")?.updateValueAndValidity();

    if (!this.formGroup.valid) {
      return;
    }

    await this.saveEmailSettings();
    await this.router.navigate(["/login-with-device"]);
  }

  protected async validateEmail(): Promise<void> {
    this.formGroup.controls.email.markAsTouched();
    const emailValid = this.formGroup.controls.email.valid;

    if (emailValid) {
      this.toggleValidateEmail(true);
      await this.getLoginWithDevice(this.loggedEmail);

      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: "welcomeBack",
        pageSubtitle: {
          subtitle: `${this.loggedEmail}`,
          translate: false,
        },
        pageIcon: this.Icons.WaveIcon,
      });
    }
  }

  protected toggleValidateEmail(value: boolean): void {
    this.validatedEmail = value;

    if (!this.validatedEmail) {
      // Reset master password only when going from validated to not validated so that autofill can work properly
      this.formGroup.controls.masterPassword.reset();
    } else {
      // Mark MP as untouched so that, when users enter email and hit enter, the MP field doesn't load with validation errors
      this.formGroup.controls.masterPassword.markAsUntouched();

      // When email is validated, focus on master password after waiting for input to be rendered
      if (this.ngZone.isStable) {
        this.masterPasswordInputRef?.nativeElement?.focus();
      } else {
        this.ngZone.onStable.pipe(take(1), takeUntil(this.destroy$)).subscribe(() => {
          this.masterPasswordInputRef?.nativeElement?.focus();
        });
      }
    }
  }

  /**
   * Set the email value from the input field.
   * @param event The event object from the input field.
   */
  onEmailBlur(event: Event) {
    const emailInput = event.target as HTMLInputElement;
    this.formGroup.controls.email.setValue(emailInput.value);
    // Call setLoginEmail so that the email is pre-populated when navigating to the "enter password" screen.
    this.loginEmailService.setLoginEmail(this.formGroup.value.email);
  }

  isLoginWithPasskeySupported() {
    return this.loginComponentService.isLoginWithPasskeySupported();
  }

  protected async goToHint(): Promise<void> {
    await this.saveEmailSettings();
    await this.router.navigateByUrl("/hint");
  }

  protected async goToRegister(): Promise<void> {
    // TODO: remove when email verification flag is removed
    const registerRoute = await firstValueFrom(this.registerRoute$);

    if (this.emailFormControl.valid) {
      await this.router.navigate([registerRoute], {
        queryParams: { email: this.emailFormControl.value },
      });
      return;
    }

    await this.router.navigate([registerRoute]);
  }

  protected async saveEmailSettings(): Promise<void> {
    this.loginEmailService.setLoginEmail(this.formGroup.value.email);
    this.loginEmailService.setRememberEmail(this.formGroup.value.rememberEmail);
    await this.loginEmailService.saveEmailSettings();
  }

  protected async continue(): Promise<void> {
    await this.validateEmail();

    if (!this.formGroup.controls.email.valid) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccured"),
        message: this.i18nService.t("invalidEmail"),
      });
      return;
    }

    this.focusInput();
  }

  private async getLoginWithDevice(email: string): Promise<void> {
    try {
      const deviceIdentifier = await this.appIdService.getAppId();
      this.isKnownDevice = await this.devicesApiService.getKnownDevice(email, deviceIdentifier);
    } catch (e) {
      this.isKnownDevice = false;
    }
  }

  private async setupCaptcha(): Promise<void> {
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVaultUrl = env.getWebVaultUrl();

    this.captcha = new CaptchaIFrame(
      window,
      webVaultUrl,
      this.i18nService,
      (token: string) => {
        this.captchaToken = token;
      },
      (error: string) => {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: error,
        });
      },
      (info: string) => {
        this.toastService.showToast({
          variant: "info",
          title: this.i18nService.t("info"),
          message: info,
        });
      },
    );
  }

  private handleCaptchaRequired(authResult: AuthResult): boolean {
    return !Utils.isNullOrWhitespace(authResult.captchaSiteKey);
  }

  private async loadEmailSettings(): Promise<void> {
    // Try to load the email from memory first
    const email = await firstValueFrom(this.loginEmailService.loginEmail$);
    const rememberEmail = this.loginEmailService.getRememberEmail();

    if (email) {
      this.formGroup.controls.email.setValue(email);
      this.formGroup.controls.rememberEmail.setValue(rememberEmail);
    } else {
      // If there is no email in memory, check for a storedEmail on disk
      const storedEmail = await firstValueFrom(this.loginEmailService.storedEmail$);

      if (storedEmail) {
        this.formGroup.controls.email.setValue(storedEmail);
        // If there is a storedEmail, rememberEmail defaults to true
        this.formGroup.controls.rememberEmail.setValue(true);
      }
    }
  }

  private focusInput() {
    const email = this.loggedEmail;
    document.getElementById(email == null || email === "" ? "email" : "masterPassword")?.focus();
  }

  private async defaultOnInit(): Promise<void> {
    let paramEmailIsSet = false;

    this.activatedRoute?.queryParams
      .pipe(
        switchMap((params) => {
          if (!params) {
            // If no params,loadEmailSettings from state
            return this.loadEmailSettings();
          }

          const qParamsEmail = params.email;

          // If there is an email in the query params, set that email as the form field value
          if (qParamsEmail != null && qParamsEmail.indexOf("@") > -1) {
            this.formGroup.controls.email.setValue(qParamsEmail);
            paramEmailIsSet = true;
          }

          // If there is no email in the query params, loadEmailSettings from state
          return paramEmailIsSet ? of(null) : this.loadEmailSettings();
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Backup check to handle unknown case where activatedRoute is not available
    // This shouldn't happen under normal circumstances
    if (!this.activatedRoute) {
      await this.loadEmailSettings();
    }
  }

  private async webOnInit(): Promise<void> {
    this.activatedRoute.queryParams.pipe(first(), takeUntil(this.destroy$)).subscribe((qParams) => {
      if (qParams.org != null) {
        const route = this.router.createUrlTree(["create-organization"], {
          queryParams: { plan: qParams.org },
        });
        this.loginComponentService.setPreviousUrl(route);
      }

      /* If there is a parameter called 'sponsorshipToken', they are coming
         from an email for sponsoring a families organization. Therefore set
         the prevousUrl to /setup/families-for-enterprise?token=<paramValue> */
      if (qParams.sponsorshipToken != null) {
        const route = this.router.createUrlTree(["setup/families-for-enterprise"], {
          queryParams: { token: qParams.sponsorshipToken },
        });
        this.loginComponentService.setPreviousUrl(route);
      }
    });

    // If there's an existing org invite, use it to get the password policies
    const orgPolicies = await this.loginComponentService.getOrgPolicies();

    this.policies = orgPolicies?.policies;
    this.showResetPasswordAutoEnrollWarning = orgPolicies?.isPolicyAndAutoEnrollEnabled;
    this.enforcedPasswordPolicyOptions = orgPolicies?.enforcedPasswordPolicyOptions;
  }

  private async desktopOnInit(): Promise<void> {
    await this.getLoginWithDevice(this.loggedEmail);

    // TODO: refactor to not use deprecated broadcaster service.
    this.broadcasterService.subscribe(BroadcasterSubscriptionId, async (message: any) => {
      this.ngZone.run(() => {
        switch (message.command) {
          case "windowIsFocused":
            if (this.deferFocus === null) {
              this.deferFocus = !message.windowIsFocused;
              if (!this.deferFocus) {
                this.focusInput();
              }
            } else if (this.deferFocus && message.windowIsFocused) {
              this.focusInput();
              this.deferFocus = false;
            }
            break;
          default:
        }
      });
    });

    this.messagingService.send("getWindowIsFocused");
  }
}
