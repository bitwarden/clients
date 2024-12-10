// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { firstValueFrom, Subject, take, takeUntil, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  LoginEmailServiceAbstraction,
  LoginStrategyServiceAbstraction,
  PasswordLoginCredentials,
  RegisterRouteService,
} from "@bitwarden/auth/common";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { ClientType, HttpStatusCode } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SyncService } from "@bitwarden/common/platform/sync";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import {
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  ToastService,
} from "@bitwarden/components";

import { AnonLayoutWrapperDataService } from "../anon-layout/anon-layout-wrapper-data.service";
import { VaultIcon, WaveIcon } from "../icons";

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
    LinkModule,
    JslibModule,
    ReactiveFormsModule,
    RouterModule,
  ],
})
export class LoginComponent implements OnInit, OnDestroy {
  @ViewChild("masterPasswordInputRef") masterPasswordInputRef: ElementRef;

  private destroy$ = new Subject<void>();
  private enforcedMasterPasswordOptions: MasterPasswordPolicyOptions = undefined;
  readonly Icons = { WaveIcon, VaultIcon };

  clientType: ClientType;
  ClientType = ClientType;
  LoginUiState = LoginUiState;
  registerRoute$ = this.registerRouteService.registerRoute$(); // TODO: remove when email verification flag is removed
  isKnownDevice = false;
  loginUiState: LoginUiState = LoginUiState.EMAIL_ENTRY;

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

  // Web properties
  enforcedPasswordPolicyOptions: MasterPasswordPolicyOptions;
  policies: Policy[];
  showResetPasswordAutoEnrollWarning = false;

  // Desktop properties
  deferFocus: boolean | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private appIdService: AppIdService,
    private broadcasterService: BroadcasterService,
    private devicesApiService: DevicesApiServiceAbstraction,
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
    private logService: LogService,
    private validationService: ValidationService,
    private configService: ConfigService,
  ) {
    this.clientType = this.platformUtilsService.getClientType();
  }

  async ngOnInit(): Promise<void> {
    // TODO: remove this when the UnauthenticatedExtensionUIRefresh feature flag is removed.
    this.listenForUnauthUiRefreshFlagChanges();

    await this.defaultOnInit();

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

  private listenForUnauthUiRefreshFlagChanges() {
    this.configService
      .getFeatureFlag$(FeatureFlag.UnauthenticatedExtensionUIRefresh)
      .pipe(
        tap(async (flag) => {
          // If the flag is turned OFF, we must force a reload to ensure the correct UI is shown
          if (!flag) {
            const uniqueQueryParams = {
              ...this.activatedRoute.queryParams,
              // adding a unique timestamp to the query params to force a reload
              t: new Date().getTime().toString(), // Adding a unique timestamp as a query parameter
            };

            await this.router.navigate(["/"], {
              queryParams: uniqueQueryParams,
            });
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  submit = async (): Promise<void> => {
    if (this.clientType === ClientType.Desktop) {
      if (this.loginUiState !== LoginUiState.MASTER_PASSWORD_ENTRY) {
        return;
      }
    }

    const { email, masterPassword } = this.formGroup.value;

    this.formGroup.markAllAsTouched();
    if (this.formGroup.invalid) {
      return;
    }

    const credentials = new PasswordLoginCredentials(
      email,
      masterPassword,
      null, // captcha no longer used in new login / registration scenarios
      null,
    );

    try {
      const authResult = await this.loginStrategyService.logIn(credentials);

      await this.saveEmailSettings();
      await this.handleAuthResult(authResult);
    } catch (error) {
      this.logService.error(error);
      this.handleSubmitError(error);
    }
  };

  /**
   * Handles the error from the submit function.
   *
   * @param error The error object.
   */
  private handleSubmitError(error: unknown) {
    // Handle error responses
    if (error instanceof ErrorResponse) {
      switch (error.statusCode) {
        case HttpStatusCode.BadRequest: {
          if (error.message.toLowerCase().includes("username or password is incorrect")) {
            this.formGroup.controls.masterPassword.setErrors({
              error: {
                message: this.i18nService.t("invalidMasterPassword"),
              },
            });
          }
          break;
        }
        default: {
          // Allow all other errors to be handled by toast
          this.validationService.showError(error);
        }
      }
    } else {
      // Allow all other errors to be handled by toast
      this.validationService.showError(error);
    }
  }

  /**
   * Handles the result of the authentication process.
   *
   * @param authResult
   * @returns A simple `return` statement for each conditional check.
   *          If you update this method, do not forget to add a `return`
   *          to each if-condition block where necessary to stop code execution.
   */
  private async handleAuthResult(authResult: AuthResult): Promise<void> {
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
    await this.evaluatePassword();

    this.loginEmailService.clearValues();

    if (this.clientType === ClientType.Browser) {
      await this.router.navigate(["/tabs/vault"]);
    } else {
      await this.router.navigate(["vault"]);
    }
  }

  protected async launchSsoBrowserWindow(clientId: "browser" | "desktop"): Promise<void> {
    await this.loginComponentService.launchSsoBrowserWindow(this.emailFormControl.value, clientId);
  }

  protected async evaluatePassword(): Promise<void> {
    try {
      // If we do not have any saved policies, attempt to load them from the service
      if (this.enforcedMasterPasswordOptions == undefined) {
        this.enforcedMasterPasswordOptions = await firstValueFrom(
          this.policyService.masterPasswordPolicyOptions$(),
        );
      }

      if (this.requirePasswordChange()) {
        await this.router.navigate(["update-password"]);
        return;
      }
    } catch (e) {
      // Do not prevent unlock if there is an error evaluating policies
      this.logService.error(e);
    }
  }

  /**
   * Checks if the master password meets the enforced policy requirements
   * If not, returns false
   */
  private requirePasswordChange(): boolean {
    if (
      this.enforcedMasterPasswordOptions == undefined ||
      !this.enforcedMasterPasswordOptions.enforceOnLogin
    ) {
      return false;
    }

    const masterPassword = this.formGroup.controls.masterPassword.value;

    const passwordStrength = this.passwordStrengthService.getPasswordStrength(
      masterPassword,
      this.formGroup.value.email,
    )?.score;

    return !this.policyService.evaluateMasterPassword(
      passwordStrength,
      masterPassword,
      this.enforcedMasterPasswordOptions,
    );
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

  protected async validateEmail(): Promise<boolean> {
    this.formGroup.controls.email.markAsTouched();
    return this.formGroup.controls.email.valid;
  }

  protected async toggleLoginUiState(value: LoginUiState): Promise<void> {
    this.loginUiState = value;

    if (this.loginUiState === LoginUiState.EMAIL_ENTRY) {
      this.loginComponentService.showBackButton(false);

      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "logInToBitwarden" },
        pageIcon: this.Icons.VaultIcon,
        pageSubtitle: null, // remove subtitle when going back to email entry
      });

      // Reset master password only when going from validated to not validated so that autofill can work properly
      this.formGroup.controls.masterPassword.reset();

      // Reset known device state when going back to email entry if it is supported
      this.isKnownDevice = false;
    } else if (this.loginUiState === LoginUiState.MASTER_PASSWORD_ENTRY) {
      this.loginComponentService.showBackButton(true);
      this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
        pageTitle: { key: "welcomeBack" },
        pageSubtitle: this.emailFormControl.value,
        pageIcon: this.Icons.WaveIcon,
      });

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

      // Check to see if the device is known so we can show the Login with Device option
      await this.getKnownDevice(this.emailFormControl.value);
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
    await this.loginEmailService.setLoginEmail(this.formGroup.value.email);
    this.loginEmailService.setRememberEmail(this.formGroup.value.rememberEmail);
    await this.loginEmailService.saveEmailSettings();
  }

  protected async continue(): Promise<void> {
    if (await this.validateEmail()) {
      await this.toggleLoginUiState(LoginUiState.MASTER_PASSWORD_ENTRY);
    }
  }

  /**
   * Call to check if the device is known.
   * Known means that the user has logged in with this device before.
   * @param email - The user's email
   */
  private async getKnownDevice(email: string): Promise<void> {
    try {
      const deviceIdentifier = await this.appIdService.getAppId();
      this.isKnownDevice = await this.devicesApiService.getKnownDevice(email, deviceIdentifier);
    } catch (e) {
      this.isKnownDevice = false;
    }
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
    document
      .getElementById(
        this.emailFormControl.value == null || this.emailFormControl.value === ""
          ? "email"
          : "masterPassword",
      )
      ?.focus();
  }

  private async defaultOnInit(): Promise<void> {
    // If there's an existing org invite, use it to get the password policies
    const orgPolicies = await this.loginComponentService.getOrgPolicies();

    this.policies = orgPolicies?.policies;
    this.showResetPasswordAutoEnrollWarning = orgPolicies?.isPolicyAndAutoEnrollEnabled;

    let paramEmailIsSet = false;

    const params = await firstValueFrom(this.activatedRoute.queryParams);

    if (params) {
      const qParamsEmail = params.email;

      // If there is an email in the query params, set that email as the form field value
      if (qParamsEmail != null && qParamsEmail.indexOf("@") > -1) {
        this.formGroup.controls.email.setValue(qParamsEmail);
        paramEmailIsSet = true;
      }
    }

    // If there are no params or no email in the query params, loadEmailSettings from state
    if (!paramEmailIsSet) {
      await this.loadEmailSettings();
    }

    // Check to see if the device is known so that we can show the Login with Device option
    await this.getKnownDevice(this.emailFormControl.value);

    // Backup check to handle unknown case where activatedRoute is not available
    // This shouldn't happen under normal circumstances
    if (!this.activatedRoute) {
      await this.loadEmailSettings();
    }
  }

  private async desktopOnInit(): Promise<void> {
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

  /**
   * Helper function to determine if the back button should be shown.
   * @returns true if the back button should be shown.
   */
  protected shouldShowBackButton(): boolean {
    return (
      this.loginUiState === LoginUiState.MASTER_PASSWORD_ENTRY &&
      this.clientType !== ClientType.Browser
    );
  }
}
