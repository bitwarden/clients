import { CommonModule } from "@angular/common";
import {
  Component,
  DestroyRef,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { firstValueFrom, Subject, take, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { VaultIcon, WaveIcon } from "@bitwarden/assets/svg";
import {
  LoginEmailServiceAbstraction,
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyData } from "@bitwarden/common/admin-console/models/data/policy.data";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
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
import { UserId } from "@bitwarden/common/types/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  AnonLayoutWrapperDataService,
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  FormFieldModule,
  IconButtonModule,
  LinkModule,
  ToastService,
} from "@bitwarden/components";

import { LoginComponentService, PasswordPolicies } from "./login-component.service";

const BroadcasterSubscriptionId = "LoginComponent";

// FIXME: update to use a const object instead of a typescript enum
// eslint-disable-next-line @bitwarden/platform/no-enums
export enum LoginUiState {
  EMAIL_ENTRY = "EmailEntry",
  MASTER_PASSWORD_ENTRY = "MasterPasswordEntry",
}

@Component({
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
  readonly Icons = { WaveIcon, VaultIcon };

  clientType: ClientType;
  ClientType = ClientType;
  orgPoliciesFromInvite: PasswordPolicies | null = null;
  LoginUiState = LoginUiState;
  isKnownDevice = false;
  loginUiState: LoginUiState = LoginUiState.EMAIL_ENTRY;
  ssoRequired = false;
  ssoRequiredCache: string[] = [];

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

  // Desktop properties
  deferFocus: boolean | null = null;

  constructor(
    private activatedRoute: ActivatedRoute,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private appIdService: AppIdService,
    private broadcasterService: BroadcasterService,
    private destroyRef: DestroyRef,
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
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private configService: ConfigService,
    private ssoLoginService: SsoLoginServiceAbstraction,
  ) {
    this.clientType = this.platformUtilsService.getClientType();
  }

  async ngOnInit(): Promise<void> {
    // Add popstate listener to listen for browser back button clicks
    window.addEventListener("popstate", this.handlePopState);

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

  private async defaultOnInit(): Promise<void> {
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

    const disableAlternateLoginMethodsFlagEnabled = await this.configService.getFeatureFlag(
      FeatureFlag.PM22110_DisableAlternateLoginMethods,
    );
    if (disableAlternateLoginMethodsFlagEnabled) {
      // SSO required check should come after email has had a chance to be pre-filled (if it
      // was found in query params or was the remembered email)
      this.ssoRequiredCache = await firstValueFrom(this.ssoLoginService.ssoRequiredCache$);

      // Only perform update and setup this subscription if there is actually a populated ssoRequiredCache list
      if (this.ssoRequiredCache != null && this.ssoRequiredCache.length > 0) {
        // If there is a pre-filled/remembered email field value, update once initially
        if (this.emailFormControl.value) {
          this.updateSsoRequiredForThisEmail();
        }

        // On subsequent email field value changes, update again
        this.formGroup.controls.email.valueChanges
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(() => {
            this.updateSsoRequiredForThisEmail();
          });
      }
    }
  }

  private updateSsoRequiredForThisEmail() {
    if (
      this.ssoRequiredCache != null &&
      this.ssoRequiredCache.includes(this.emailFormControl.value)
    ) {
      this.ssoRequired = true;
    } else {
      this.ssoRequired = false;
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

    // Try to retrieve any org policies from an org invite now so we can send it to the
    // login strategies. Since it is optional and we only want to be doing this on the
    // web we will only send in content in the right context.
    this.orgPoliciesFromInvite = this.loginComponentService.getOrgPoliciesFromOrgInvite
      ? await this.loginComponentService.getOrgPoliciesFromOrgInvite(email)
      : null;

    const orgMasterPasswordPolicyOptions =
      this.orgPoliciesFromInvite?.enforcedPasswordPolicyOptions;

    const credentials = new PasswordLoginCredentials(
      email,
      masterPassword,
      undefined,
      orgMasterPasswordPolicyOptions,
    );

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
          if (error.message?.toLowerCase().includes("username or password is incorrect")) {
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
         This is now unsupported and requires a downgraded client */
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("legacyEncryptionUnsupported"),
      });
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

    // User logged in successfully so execute side effects
    await this.loginSuccessHandlerService.run(authResult.userId);

    // Determine where to send the user next
    // The AuthGuard will handle routing to change-password based on state

    // TODO: PM-18269 - evaluate if we can combine this with the
    // password evaluation done in the password login strategy.
    if (this.orgPoliciesFromInvite) {
      // Since we have retrieved the policies, we can go ahead and set them into state for future use
      // e.g., the change-password page currently only references state for policy data and
      // doesn't fallback to pulling them from the server like it should if they are null.
      await this.setPoliciesIntoState(authResult.userId, this.orgPoliciesFromInvite.policies);

      const isPasswordChangeRequired = await this.isPasswordChangeRequiredByOrgPolicy(
        this.orgPoliciesFromInvite.enforcedPasswordPolicyOptions,
      );
      if (isPasswordChangeRequired) {
        await this.router.navigate(["change-password"]);
        return;
      }
    }

    if (this.clientType === ClientType.Browser) {
      await this.router.navigate(["/tabs/vault"]);
    } else {
      await this.router.navigate(["vault"]);
    }
  }

  /**
   * Checks if the master password meets the enforced policy requirements
   * and if the user is required to change their password.
   *
   * TODO: This is duplicate checking that we want to only do in the password login strategy.
   *       Once we no longer need the policies state being set to reference later in change password
   *       via using the Admin Console's new policy endpoint changes we can remove this. Consult
   *       PM-23001 for details.
   */
  private async isPasswordChangeRequiredByOrgPolicy(
    enforcedPasswordPolicyOptions: MasterPasswordPolicyOptions,
  ): Promise<boolean> {
    try {
      if (enforcedPasswordPolicyOptions == undefined) {
        return false;
      }

      // Note: we deliberately do not check enforcedPasswordPolicyOptions.enforceOnLogin
      // as existing users who are logging in after getting an org invite should
      // always be forced to set a password that meets the org's policy.
      // Org Invite -> Registration also works this way for new BW users as well.

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
        enforcedPasswordPolicyOptions,
      );
    } catch (e) {
      // Do not prevent unlock if there is an error evaluating policies
      this.logService.error(e);
      return false;
    }
  }

  private async setPoliciesIntoState(userId: UserId, policies: Policy[]): Promise<void> {
    const policiesData: { [id: string]: PolicyData } = {};
    policies.map((p) => (policiesData[p.id] = PolicyData.fromPolicy(p)));
    await this.policyService.replace(policiesData, userId);
  }

  protected async startAuthRequestLogin(): Promise<void> {
    this.formGroup.get("masterPassword")?.clearValidators();
    this.formGroup.get("masterPassword")?.updateValueAndValidity();

    if (!this.formGroup.valid) {
      return;
    }

    await this.router.navigate(["/login-with-device"]);
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
    const isEmailValid = this.validateEmail();

    if (isEmailValid) {
      await this.toggleLoginUiState(LoginUiState.MASTER_PASSWORD_ENTRY);
    }
  }

  /**
   * Handle the Login with Passkey button click.
   * We need a handler here in order to persist the remember email selection to state before routing.
   * @param event - The event object.
   */
  async handleLoginWithPasskeyClick() {
    await this.router.navigate(["/login-with-passkey"]);
  }

  /**
   * Handle the SSO button click.
   * @param event - The event object.
   */
  async handleSsoClick() {
    // Make sure the email is valid
    const isEmailValid = this.validateEmail();
    if (!isEmailValid) {
      return;
    }

    // Make sure the email is not empty, for type safety
    const email = this.formGroup.value.email;
    if (!email) {
      this.logService.error("Email is required for SSO");
      return;
    }

    // Send the user to SSO, either through routing or through redirecting to the web app
    await this.loginComponentService.redirectToSsoLogin(email);
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
      // If we load an email into the form, we need to initialize it for the login process as well
      // so that other login components can use it.
      // We do this here as it's possible that a user doesn't edit the email field before submitting.
      await this.loginEmailService.setLoginEmail(storedEmail);
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
   * Validates the email and displays any validation errors.
   * @returns true if the email is valid, false otherwise.
   */
  protected validateEmail(): boolean {
    this.formGroup.controls.email.markAsTouched();
    this.formGroup.controls.email.updateValueAndValidity({ onlySelf: true, emitEvent: true });
    return this.formGroup.controls.email.valid;
  }

  /**
   * Persist the entered email address and the user's choice to remember it to state.
   */
  private async persistEmailIfValid(): Promise<void> {
    if (this.formGroup.controls.email.valid) {
      const email = this.formGroup.value.email;
      const rememberEmail = this.formGroup.value.rememberEmail ?? false;
      if (!email) {
        return;
      }
      await this.loginEmailService.setLoginEmail(email);
      await this.loginEmailService.setRememberedEmailChoice(email, rememberEmail);
    } else {
      await this.loginEmailService.clearLoginEmail();
      await this.loginEmailService.clearRememberedEmail();
    }
  }

  /**
   * Set the email value from the input field and persists to state if valid.
   * We only update the form controls onSubmit instead of onBlur because we don't want to show validation errors until
   * the user submits. This is because currently our validation errors are shown below the input fields, and
   * displaying them causes the screen to "jump".
   * @param event The event object from the input field.
   */
  async onEmailInput(event: Event) {
    const emailInput = event.target as HTMLInputElement;
    this.formGroup.controls.email.setValue(emailInput.value);
    await this.persistEmailIfValid();
  }

  /**
   * Set the Remember Email value from the input field and persists to state if valid.
   * We only update the form controls onSubmit instead of onBlur because we don't want to show validation errors until
   * the user submits. This is because currently our validation errors are shown below the input fields, and
   * displaying them causes the screen to "jump".
   * @param event The event object from the input field.
   */
  async onRememberEmailInput(event: Event) {
    const rememberEmailInput = event.target as HTMLInputElement;
    this.formGroup.controls.rememberEmail.setValue(rememberEmailInput.checked);
    await this.persistEmailIfValid();
  }
}
