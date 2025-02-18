import { CommonModule } from "@angular/common";
import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { firstValueFrom, Subject, take, takeUntil, tap } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  LoginEmailServiceAbstraction,
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  PasswordLoginCredentials,
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
  @ViewChild("masterPasswordInputRef") masterPasswordInputRef: ElementRef | undefined;

  private destroy$ = new Subject<void>();
  private enforcedMasterPasswordOptions: MasterPasswordPolicyOptions | undefined = undefined;
  readonly Icons = { WaveIcon, VaultIcon };

  clientType: ClientType;
  ClientType = ClientType;
  LoginUiState = LoginUiState;
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

  get emailFormControl(): FormControl<string | null> {
    return this.formGroup.controls.email;
  }

  // Web properties
  enforcedPasswordPolicyOptions: MasterPasswordPolicyOptions | undefined;
  policies: Policy[] | undefined;
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
    private router: Router,
    private toastService: ToastService,
    private logService: LogService,
    private validationService: ValidationService,
    private configService: ConfigService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
  ) {
    this.clientType = this.platformUtilsService.getClientType();
  }

  async ngOnInit(): Promise<void> {
    // Add popstate listener to listen for browser back button clicks
    window.addEventListener("popstate", this.handlePopState);

    // TODO: remove this when the UnauthenticatedExtensionUIRefresh feature flag is removed.
    this.listenForUnauthUiRefreshFlagChanges();

    await this.defaultOnInit();

    if (this.clientType === ClientType.Desktop) {
      await this.desktopOnInit();
    }
  }

  ngOnDestroy(): void {
    // Remove popstate listener
    window.removeEventListener("popstate", this.handlePopState);

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

    if (!email || !masterPassword) {
      this.logService.error("Email and master password are required");
      return;
    }

    const credentials = new PasswordLoginCredentials(email, masterPassword);

    try {
      const authResult = await this.loginStrategyService.logIn(credentials);

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
          } else {
            // Allow other 400 responses to be handled by toast
            this.validationService.showError(error);
          }
          break;
        }
        default: {
          // Allow all other error codes to be handled by toast
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

    // Redirect to device verification if this is an unknown device
    if (authResult.requiresDeviceVerification) {
      await this.router.navigate(["device-verification"]);
      return;
    }

    await this.loginSuccessHandlerService.run(authResult.userId);

    if (authResult.forcePasswordReset != ForceSetPasswordReason.None) {
      await this.router.navigate(["update-temp-password"]);
      return;
    }

    // If none of the above cases are true, route the user to the vault

    if (this.clientType === ClientType.Browser) {
      await this.router.navigate(["/tabs/vault"]);
    } else {
      await this.router.navigate(["vault"]);
    }
  }

  /**
   * Evaluates the master password against the enforced policy options.
   * If the password does not meet the requirements, the user is redirected to the update-password page.
   */
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

    // Return false if masterPassword is null/undefined since this is only evaluated after successful login
    if (!masterPassword) {
      return false;
    }

    const passwordStrength = this.passwordStrengthService.getPasswordStrength(
      masterPassword,
      this.formGroup.value.email ?? undefined,
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

    await this.router.navigate(["/login-with-device"]);
  }

  protected async validateEmail(): Promise<boolean> {
    this.updateFormControls();
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
      const email = this.emailFormControl.value;
      if (email) {
        await this.getKnownDevice(email);
      }
    }
  }

  /**
   * Set the email value from the input field.
   * @param event The event object from the input field.
   */
  onEmailInput(event: Event) {
    const emailInput = event.target as HTMLInputElement;
    this.formGroup.controls.email.setValue(emailInput.value);
  }

  onRememberMeInput(event: Event) {
    const rememberMeInput = event.target as HTMLInputElement;
    this.formGroup.controls.rememberEmail.setValue(rememberMeInput.checked);
  }

  isLoginWithPasskeySupported() {
    return this.loginComponentService.isLoginWithPasskeySupported();
  }

  protected async goToHint(): Promise<void> {
    await this.router.navigateByUrl("/hint");
  }

  /**
   * Continue button clicked (or enter key pressed).
   * Adds the login url to the browser's history so that the back button can be used to go back to the email entry state.
   * Needs to be separate from the continue() function because that can be triggered by the browser's forward button.
   */
  protected async continuePressed() {
    // Add a new entry to the browser's history so that there is a history entry to go back to
    history.pushState({}, "", window.location.href);
    await this.continue();
  }

  /**
   * Continue to the master password entry state (only if email is validated)
   */
  protected async continue(): Promise<void> {
    const isEmailValid = await this.validateEmail();

    if (isEmailValid) {
      await this.persistLoginEmail();
      await this.toggleLoginUiState(LoginUiState.MASTER_PASSWORD_ENTRY);
    }
  }

  /**
   * Call to check if the device is known.
   * Known means that the user has logged in with this device before.
   * @param email - The user's email
   */
  private async getKnownDevice(email: string): Promise<void> {
    if (!email) {
      this.isKnownDevice = false;
      return;
    }

    try {
      const deviceIdentifier = await this.appIdService.getAppId();
      this.isKnownDevice = await this.devicesApiService.getKnownDevice(email, deviceIdentifier);
      // FIXME: Remove when updating file. Eslint update
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      this.isKnownDevice = false;
    }
  }

  /**
   * Check to see if the user has remembered an email on the current device.
   * If so, set the email in the form field and set rememberEmail to true. If not, set rememberEmail to false.
   */
  private async loadRememberedEmail(): Promise<void> {
    const storedEmail = await firstValueFrom(this.loginEmailService.rememberedEmail$);
    if (storedEmail) {
      this.formGroup.controls.email.setValue(storedEmail);
      this.formGroup.controls.rememberEmail.setValue(true);
    } else {
      this.formGroup.controls.rememberEmail.setValue(false);
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
    this.showResetPasswordAutoEnrollWarning = orgPolicies?.isPolicyAndAutoEnrollEnabled ?? false;

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
      await this.loadRememberedEmail();
    }

    // Check to see if the device is known so that we can show the Login with Device option
    if (this.emailFormControl.value) {
      await this.getKnownDevice(this.emailFormControl.value);
    }

    // Backup check to handle unknown case where activatedRoute is not available
    // This shouldn't happen under normal circumstances
    if (!this.activatedRoute) {
      await this.loadRememberedEmail();
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

  /**
   * Handle the back button click to transition back to the email entry state.
   */
  protected async backButtonClicked() {
    history.back();
  }

  /**
   * Handle the popstate event to transition back to the email entry state when the back button is clicked.
   * Also handles the case where the user clicks the forward button.
   * @param event - The popstate event.
   */
  private handlePopState = async (event: PopStateEvent) => {
    if (this.loginUiState === LoginUiState.MASTER_PASSWORD_ENTRY) {
      // Prevent default navigation when the browser's back button is clicked
      event.preventDefault();
      // Transition back to email entry state
      void this.toggleLoginUiState(LoginUiState.EMAIL_ENTRY);
    } else if (this.loginUiState === LoginUiState.EMAIL_ENTRY) {
      // Prevent default navigation when the browser's forward button is clicked
      event.preventDefault();
      // Continue to the master password entry state
      await this.continue();
    }
  };

  /**
   * Handle the Login with Passkey button click.
   * We need a handler here in order to persist the remember email selection to state before routing.
   * @param event - The event object.
   */
  async handleLoginWithPasskeyClick() {
    this.updateFormControls();
    const email = this.formGroup.value.email;
    if (email) {
      await this.persistLoginEmail();
    }
    await this.router.navigate(["/login-with-passkey"]);
  }

  /**
   * Handle the SSO button click.
   */
  async handleSsoClick() {
    // Make sure the email is not empty, for type safety
    const email = this.formGroup.value.email;
    if (!email) {
      this.logService.error("Email is required for SSO");
      return;
    }

    // Make sure the email is valid
    const isEmailValid = await this.validateEmail();
    if (!isEmailValid) {
      return;
    }

    // Save the email configuration for the login component
    await this.persistLoginEmail();

    // Send the user to SSO, either through routing or through redirecting to the web app
    await this.loginComponentService.redirectToSsoLogin(email);
  }

  /**
   *
   * @returns
   */
  private async persistLoginEmail(): Promise<void> {
    this.updateFormControls();

    const email = this.formGroup.value.email;
    const rememberEmail = this.formGroup.value.rememberEmail ?? false;
    if (!email) {
      this.logService.error("Email is required to persist to state.");
      return;
    }

    await this.loginEmailService.setLoginEmail(email);
    await this.loginEmailService.setRememberedEmailChoice(email, rememberEmail);
  }

  /**
   * We only update the form controls onSubmit instead of onBlur because we don't want to show validation errors until
   * the user submits. This is because currently our validation errors are shown below the input fields, and
   * displaying them causes the screen to "jump".
   */
  private updateFormControls(): void {
    this.formGroup.controls.email.markAsTouched();
    this.formGroup.controls.email.updateValueAndValidity({ onlySelf: true, emitEvent: true });

    this.formGroup.controls.rememberEmail.markAsTouched();
    this.formGroup.controls.rememberEmail.updateValueAndValidity({ onlySelf: true });
  }
}
