import { CommonModule } from "@angular/common";
import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { firstValueFrom, Subject, take, takeUntil } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  LoginEmailServiceAbstraction,
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
  OpaqueLoginCredentials,
  PasswordLoginCredentials,
} from "@bitwarden/auth/common";
import { InternalPolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { PolicyData } from "@bitwarden/common/admin-console/models/data/policy.data";
import { MasterPasswordPolicyOptions } from "@bitwarden/common/admin-console/models/domain/master-password-policy-options";
import { Policy } from "@bitwarden/common/admin-console/models/domain/policy";
import { DevicesApiServiceAbstraction } from "@bitwarden/common/auth/abstractions/devices-api.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { PreloginRequest } from "@bitwarden/common/auth/models/request/prelogin.request";
import { PreLoginApiService } from "@bitwarden/common/auth/services/pre-login-api.service";
import { ClientType, HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { BroadcasterService } from "@bitwarden/common/platform/abstractions/broadcaster.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { UserId } from "@bitwarden/common/types/guid";
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

import { LoginComponentService, PasswordPolicies } from "./login-component.service";

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
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private preLoginApiService: PreLoginApiService,
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

    try {
      // TODO: is it worth having a pre-password-login.service to extract some of this process out of the
      // component?  We could at least maybe add a separately testable mechanism for building the
      // kdf config off of the prelogin response.
      // Or should we put the prelogin process and determination of the login strategy all back into the
      // login strategy service for re-use in places like the CLI?

      const preLoginRequest = new PreloginRequest(email);
      const preLoginResponse = await this.preLoginApiService.postPrelogin(preLoginRequest);

      // Determine which credentials to build based on response
      let credentials: PasswordLoginCredentials | OpaqueLoginCredentials;

      if (preLoginResponse.opaqueConfiguration) {
        credentials = new OpaqueLoginCredentials(
          email,
          masterPassword,
          preLoginResponse.opaqueConfiguration,
        );
      } else {
        // Determine users KDF config based on response
        const kdfConfig = preLoginResponse.toKdfConfig();

        credentials = new PasswordLoginCredentials(email, masterPassword, kdfConfig);
      }

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

    // User logged in successfully so execute side effects
    await this.loginSuccessHandlerService.run(authResult.userId);
    this.loginEmailService.clearValues();

    // Determine where to send the user next
    if (authResult.forcePasswordReset != ForceSetPasswordReason.None) {
      await this.router.navigate(["update-temp-password"]);
      return;
    }

    // TODO: PM-18269 - evaluate if we can combine this with the
    // password evaluation done in the password login strategy.
    // If there's an existing org invite, use it to get the org's password policies
    // so we can evaluate the MP against the org policies
    if (this.loginComponentService.getOrgPoliciesFromOrgInvite) {
      const orgPolicies: PasswordPolicies | null =
        await this.loginComponentService.getOrgPoliciesFromOrgInvite();

      if (orgPolicies) {
        // Since we have retrieved the policies, we can go ahead and set them into state for future use
        // e.g., the update-password page currently only references state for policy data and
        // doesn't fallback to pulling them from the server like it should if they are null.
        await this.setPoliciesIntoState(authResult.userId, orgPolicies.policies);

        const isPasswordChangeRequired = await this.isPasswordChangeRequiredByOrgPolicy(
          orgPolicies.enforcedPasswordPolicyOptions,
        );
        if (isPasswordChangeRequired) {
          await this.router.navigate(["update-password"]);
          return;
        }
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

    await this.saveEmailSettings();
    await this.router.navigate(["/login-with-device"]);
  }

  protected async validateEmail(): Promise<boolean> {
    this.formGroup.controls.email.markAsTouched();
    this.formGroup.controls.email.updateValueAndValidity({ onlySelf: true, emitEvent: true });
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
    this.loginEmailService.setLoginEmail(emailInput.value);
  }

  isLoginWithPasskeySupported() {
    return this.loginComponentService.isLoginWithPasskeySupported();
  }

  protected async goToHint(): Promise<void> {
    await this.saveEmailSettings();
    await this.router.navigateByUrl("/hint");
  }

  protected async saveEmailSettings(): Promise<void> {
    const email = this.formGroup.value.email;
    if (!email) {
      this.logService.error("Email is required to save email settings.");
      return;
    }

    await this.loginEmailService.setLoginEmail(email);
    this.loginEmailService.setRememberEmail(this.formGroup.value.rememberEmail ?? false);
    await this.loginEmailService.saveEmailSettings();
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
    if (this.emailFormControl.value) {
      await this.getKnownDevice(this.emailFormControl.value);
    }

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
   * Handle the SSO button click.
   */
  async handleSsoClick() {
    const email = this.formGroup.value.email;

    // Make sure the email is valid
    const isEmailValid = await this.validateEmail();
    if (!isEmailValid) {
      return;
    }

    // Make sure the email is not empty, for type safety
    if (!email) {
      this.logService.error("Email is required for SSO");
      return;
    }

    // Save the email configuration for the login component
    await this.saveEmailSettings();

    // Send the user to SSO, either through routing or through redirecting to the web app
    await this.loginComponentService.redirectToSsoLogin(email);
  }
}
