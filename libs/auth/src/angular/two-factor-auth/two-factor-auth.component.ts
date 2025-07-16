import { CommonModule } from "@angular/common";
import {
  Component,
  DestroyRef,
  ElementRef,
  Inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router } from "@angular/router";
import { lastValueFrom, firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
  TrustedDeviceUserDecryptionOption,
  UserDecryptionOptions,
  LoginSuccessHandlerService,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/key-management/master-password/abstractions/master-password.service.abstraction";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { UserId } from "@bitwarden/common/types/guid";
// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import {
  AnonLayoutWrapperDataService,
  AsyncActionsModule,
  ButtonModule,
  CheckboxModule,
  DialogService,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";

import {
  TwoFactorAuthAuthenticatorIcon,
  TwoFactorAuthEmailIcon,
  TwoFactorAuthWebAuthnIcon,
  TwoFactorAuthSecurityKeyIcon,
  TwoFactorAuthDuoIcon,
} from "../icons/two-factor-auth";

import { TwoFactorAuthAuthenticatorComponent } from "./child-components/two-factor-auth-authenticator/two-factor-auth-authenticator.component";
import { TwoFactorAuthDuoComponent } from "./child-components/two-factor-auth-duo/two-factor-auth-duo.component";
import { TwoFactorAuthEmailComponent } from "./child-components/two-factor-auth-email/two-factor-auth-email.component";
import { TwoFactorAuthWebAuthnComponent } from "./child-components/two-factor-auth-webauthn/two-factor-auth-webauthn.component";
import { TwoFactorAuthYubikeyComponent } from "./child-components/two-factor-auth-yubikey/two-factor-auth-yubikey.component";
import {
  TwoFactorAuthComponentCacheService,
  TwoFactorAuthComponentData,
} from "./two-factor-auth-component-cache.service";
import {
  DuoLaunchAction,
  TwoFactorAuthComponentService,
} from "./two-factor-auth-component.service";
import {
  TwoFactorOptionsComponent,
  TwoFactorOptionsDialogResult,
} from "./two-factor-options.component";

@Component({
  selector: "app-two-factor-auth",
  templateUrl: "two-factor-auth.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    CheckboxModule,
    ButtonModule,
    TwoFactorAuthAuthenticatorComponent,
    TwoFactorAuthEmailComponent,
    TwoFactorAuthDuoComponent,
    TwoFactorAuthYubikeyComponent,
    TwoFactorAuthWebAuthnComponent,
  ],
  providers: [
    {
      provide: TwoFactorAuthComponentCacheService,
    },
  ],
})
export class TwoFactorAuthComponent implements OnInit, OnDestroy {
  @ViewChild("continueButton", { read: ElementRef, static: false }) continueButton:
    | ElementRef
    | undefined = undefined;

  loading = true;

  orgSsoIdentifier: string | undefined = undefined;

  providerType = TwoFactorProviderType;
  selectedProviderType: TwoFactorProviderType = TwoFactorProviderType.Authenticator;

  // TODO: PM-17176 - build more specific type for 2FA metadata
  twoFactorProviders: Map<TwoFactorProviderType, { [key: string]: string }> | null = null;
  selectedProviderData: { [key: string]: string } | undefined;

  @ViewChild("duoComponent") duoComponent!: TwoFactorAuthDuoComponent;

  form = this.formBuilder.group({
    token: [
      "",
      {
        validators: [Validators.required],
        updateOn: "submit",
      },
    ],
    remember: [false],
  });

  get tokenFormControl() {
    return this.form.controls.token;
  }

  get rememberFormControl() {
    return this.form.controls.remember;
  }

  formPromise: Promise<any> | undefined;

  duoLaunchAction: DuoLaunchAction | undefined = undefined;
  DuoLaunchAction = DuoLaunchAction;

  webAuthInNewTab = false;

  private authenticationSessionTimeoutRoute = "authentication-timeout";

  constructor(
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private router: Router,
    private i18nService: I18nService,
    private platformUtilsService: PlatformUtilsService,
    private dialogService: DialogService,
    private activatedRoute: ActivatedRoute,
    private logService: LogService,
    private twoFactorService: TwoFactorService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    private ssoLoginService: SsoLoginServiceAbstraction,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    @Inject(WINDOW) protected win: Window,
    private toastService: ToastService,
    private twoFactorAuthComponentService: TwoFactorAuthComponentService,
    private destroyRef: DestroyRef,
    private anonLayoutWrapperDataService: AnonLayoutWrapperDataService,
    private environmentService: EnvironmentService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private twoFactorAuthComponentCacheService: TwoFactorAuthComponentCacheService,
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  async ngOnInit() {
    this.orgSsoIdentifier =
      this.activatedRoute.snapshot.queryParamMap.get("identifier") ?? undefined;

    this.listenForAuthnSessionTimeout();

    // Load cached form data if available
    let loadedCachedProviderType = false;
    const cachedData = this.twoFactorAuthComponentCacheService.getCachedData();
    if (cachedData) {
      if (cachedData.token) {
        this.form.patchValue({ token: cachedData.token });
      }
      if (cachedData.remember !== undefined) {
        this.form.patchValue({ remember: cachedData.remember });
      }
      if (cachedData.selectedProviderType !== undefined) {
        this.selectedProviderType = cachedData.selectedProviderType;
        loadedCachedProviderType = true;
      }
    }

    // If we don't have a cached provider type, set it to the default and cache it
    if (!loadedCachedProviderType) {
      this.selectedProviderType = await this.initializeSelected2faProviderType();
      this.twoFactorAuthComponentCacheService.cacheData({
        selectedProviderType: this.selectedProviderType,
      });
    }

    await this.set2faProvidersAndData();
    await this.setAnonLayoutDataByTwoFactorProviderType();

    await this.twoFactorAuthComponentService.extendPopupWidthIfRequired?.(
      this.selectedProviderType,
    );

    this.duoLaunchAction = this.twoFactorAuthComponentService.determineDuoLaunchAction();

    this.loading = false;
  }

  /**
   * Save specific form data fields to the cache
   */
  async saveFormDataWithPartialData(data: Partial<TwoFactorAuthComponentData>) {
    // Get current cached data
    const currentData = this.twoFactorAuthComponentCacheService.getCachedData();

    this.twoFactorAuthComponentCacheService.cacheData({
      token: data?.token ?? currentData?.token ?? "",
      remember: data?.remember ?? currentData?.remember ?? false,
      selectedProviderType: data?.selectedProviderType ?? currentData?.selectedProviderType,
    });
  }

  /**
   * Save the remember value to the cache when the checkbox is checked or unchecked
   */
  async onRememberChange() {
    const rememberValue = !!this.rememberFormControl.value;
    await this.saveFormDataWithPartialData({ remember: rememberValue });
  }

  private async initializeSelected2faProviderType(): Promise<TwoFactorProviderType> {
    const webAuthnSupported = this.platformUtilsService.supportsWebAuthn(this.win);

    if (
      this.twoFactorAuthComponentService.shouldCheckForWebAuthnQueryParamResponse() &&
      webAuthnSupported
    ) {
      const webAuthn2faResponse = this.activatedRoute.snapshot.paramMap.get("webAuthnResponse");
      if (webAuthn2faResponse) {
        return TwoFactorProviderType.WebAuthn;
      }
    }

    return await this.twoFactorService.getDefaultProvider(webAuthnSupported);
  }

  private async set2faProvidersAndData() {
    this.twoFactorProviders = await this.twoFactorService.getProviders();
    if (this.selectedProviderType !== undefined) {
      const providerData = this.twoFactorProviders?.get(this.selectedProviderType);
      this.selectedProviderData = providerData;
    }
  }

  private listenForAuthnSessionTimeout() {
    this.loginStrategyService.authenticationSessionTimeout$
      .pipe(takeUntilDestroyed(this.destroyRef))
      // TODO: Fix this!
      // eslint-disable-next-line rxjs/no-async-subscribe
      .subscribe(async (expired) => {
        if (!expired) {
          return;
        }

        try {
          await this.router.navigate([this.authenticationSessionTimeoutRoute]);
        } catch (err) {
          this.logService.error(
            `Failed to navigate to ${this.authenticationSessionTimeoutRoute} route`,
            err,
          );
        }
      });
  }

  submit = async (token?: string, remember?: boolean) => {
    // 2FA submission either comes via programmatic submission for flows like
    // WebAuthn or Duo, or via the form submission for other 2FA providers.
    // So, we have to figure out whether we need to validate the form or not.
    let tokenValue: string;
    if (token !== undefined) {
      if (token === "" || token === null) {
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccurred"),
          message: this.i18nService.t("verificationCodeRequired"),
        });
        return;
      }

      // Token has been passed in so no need to validate the form
      tokenValue = token;
    } else {
      // We support programmatic submission via enter key press, but we only update on submit
      // so we have to manually update the form here for the invalid check to be accurate.
      this.tokenFormControl.markAsTouched();
      this.tokenFormControl.markAsDirty();
      this.tokenFormControl.updateValueAndValidity();

      // Token has not been passed in ensure form is valid before proceeding.
      if (this.form.invalid) {
        // returning as form validation will show the relevant errors.
        return;
      }

      // This shouldn't be possible w/ the required form validation, but
      // to satisfy strict TS checks, have to check for null here.
      const tokenFormValue = this.tokenFormControl.value;

      if (!tokenFormValue) {
        return;
      }

      tokenValue = tokenFormValue.trim();
    }

    // In all flows but WebAuthn, the remember value is taken from the form.
    const rememberValue = remember ?? this.rememberFormControl.value ?? false;

    // Cache form data before submitting
    this.twoFactorAuthComponentCacheService.cacheData({
      token: tokenValue,
      remember: rememberValue,
      selectedProviderType: this.selectedProviderType,
    });

    try {
      this.formPromise = this.loginStrategyService.logInTwoFactor(
        new TokenTwoFactorRequest(this.selectedProviderType, tokenValue, rememberValue),
      );
      const authResult: AuthResult = await this.formPromise;
      this.logService.info("Successfully submitted two factor token");

      await this.handleAuthResult(authResult);
    } catch {
      this.logService.error("Error submitting two factor token");
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("invalidVerificationCode"),
      });
    }
  };

  async selectOtherTwoFactorMethod() {
    const dialogRef = TwoFactorOptionsComponent.open(this.dialogService);
    const response: TwoFactorOptionsDialogResult | string | undefined = await lastValueFrom(
      dialogRef.closed,
    );

    if (response !== undefined && response !== null && typeof response !== "string") {
      const providerData = await this.twoFactorService.getProviders().then((providers) => {
        return providers?.get(response.type);
      });
      this.selectedProviderData = providerData;
      this.selectedProviderType = response.type;
      await this.setAnonLayoutDataByTwoFactorProviderType();

      // Update the cached provider type when a new one is chosen
      this.twoFactorAuthComponentCacheService.cacheData({
        token: "",
        remember: false,
        selectedProviderType: response.type,
      });

      this.form.reset();
      this.form.updateValueAndValidity();
    }
  }

  async launchDuo() {
    if (this.duoComponent != null && this.duoLaunchAction !== undefined) {
      await this.duoComponent.launchDuoFrameless(this.duoLaunchAction);
    }
  }

  protected async handleMigrateEncryptionKey(result: AuthResult): Promise<boolean> {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }

    this.toastService.showToast({
      variant: "error",
      title: this.i18nService.t("errorOccurred"),
      message: this.i18nService.t("legacyEncryptionUnsupported"),
    });
    return true;
  }

  async setAnonLayoutDataByTwoFactorProviderType() {
    switch (this.selectedProviderType) {
      case TwoFactorProviderType.Authenticator:
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageSubtitle: this.i18nService.t("enterTheCodeFromYourAuthenticatorApp"),
          pageIcon: TwoFactorAuthAuthenticatorIcon,
        });
        break;
      case TwoFactorProviderType.Email:
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageSubtitle: this.i18nService.t("enterTheCodeSentToYourEmail"),
          pageIcon: TwoFactorAuthEmailIcon,
        });
        break;
      case TwoFactorProviderType.Duo:
      case TwoFactorProviderType.OrganizationDuo:
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageSubtitle: this.i18nService.t("duoTwoFactorRequiredPageSubtitle"),
          pageIcon: TwoFactorAuthDuoIcon,
        });
        break;
      case TwoFactorProviderType.Yubikey:
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageSubtitle: this.i18nService.t("pressYourYubiKeyToAuthenticate"),
          pageIcon: TwoFactorAuthSecurityKeyIcon,
        });
        break;
      case TwoFactorProviderType.WebAuthn:
        this.anonLayoutWrapperDataService.setAnonLayoutWrapperData({
          pageSubtitle: this.i18nService.t("followTheStepsBelowToFinishLoggingInWithSecurityKey"),
          pageIcon: TwoFactorAuthWebAuthnIcon,
        });
        break;
      default:
        this.logService.error(
          "setAnonLayoutDataByTwoFactorProviderType: Unhandled 2FA provider type",
          this.selectedProviderType,
        );
        break;
    }
  }

  private async handleAuthResult(authResult: AuthResult) {
    // Clear form cache
    this.twoFactorAuthComponentCacheService.clearCachedData();

    if (await this.handleMigrateEncryptionKey(authResult)) {
      return; // stop login process
    }

    // User is fully logged in so handle any post login logic before executing navigation
    await this.loginSuccessHandlerService.run(authResult.userId);

    // Save off the OrgSsoIdentifier for use in the TDE flows
    // - TDE login decryption options component
    // - Browser SSO on extension open
    if (this.orgSsoIdentifier !== undefined) {
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      await this.ssoLoginService.setActiveUserOrganizationSsoIdentifier(
        this.orgSsoIdentifier,
        userId,
      );
    }

    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );

    const tdeEnabled = await this.isTrustedDeviceEncEnabled(userDecryptionOpts.trustedDeviceOption);

    if (tdeEnabled) {
      return await this.handleTrustedDeviceEncryptionEnabled(authResult.userId, userDecryptionOpts);
    }

    // User must set password if they don't have one and they aren't using either TDE or key connector.
    const requireSetPassword =
      !userDecryptionOpts.hasMasterPassword && userDecryptionOpts.keyConnectorOption === undefined;

    // New users without a master password must set a master password before advancing.
    if (requireSetPassword || authResult.resetMasterPassword) {
      // Change implies going no password -> password in this case
      return await this.handleChangePasswordRequired(this.orgSsoIdentifier);
    }

    this.twoFactorAuthComponentService.reloadOpenWindows?.();

    const inSingleActionPopoutWhichWasClosed =
      await this.twoFactorAuthComponentService.closeSingleActionPopouts?.();

    if (inSingleActionPopoutWhichWasClosed) {
      // No need to execute navigation as the single action popout was closed
      return;
    }

    const defaultSuccessRoute = await this.determineDefaultSuccessRoute(authResult.userId);

    await this.router.navigate([defaultSuccessRoute], {
      queryParams: {
        identifier: this.orgSsoIdentifier,
      },
    });
  }

  private async determineDefaultSuccessRoute(userId: UserId): Promise<string> {
    const activeAccountStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    if (activeAccountStatus === AuthenticationStatus.Locked) {
      return "lock";
    }

    // TODO: PM-22663 use the new service to handle routing.
    if (
      await this.configService.getFeatureFlag(FeatureFlag.PM16117_ChangeExistingPasswordRefactor)
    ) {
      const forceSetPasswordReason = await firstValueFrom(
        this.masterPasswordService.forceSetPasswordReason$(userId),
      );

      if (
        forceSetPasswordReason === ForceSetPasswordReason.WeakMasterPassword ||
        forceSetPasswordReason === ForceSetPasswordReason.AdminForcePasswordReset
      ) {
        return "change-password";
      }
    }

    return "vault";
  }

  private async isTrustedDeviceEncEnabled(
    trustedDeviceOption: TrustedDeviceUserDecryptionOption | undefined,
  ): Promise<boolean> {
    const ssoTo2faFlowActive = this.activatedRoute.snapshot.queryParamMap.get("sso") === "true";

    return ssoTo2faFlowActive && trustedDeviceOption !== undefined;
  }

  private async handleTrustedDeviceEncryptionEnabled(
    userId: UserId,
    userDecryptionOpts: UserDecryptionOptions,
  ): Promise<void> {
    // Tde offboarding takes precedence
    if (
      !userDecryptionOpts.hasMasterPassword &&
      userDecryptionOpts.trustedDeviceOption?.isTdeOffboarding
    ) {
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeOffboarding,
        userId,
      );
    } else if (
      !userDecryptionOpts.hasMasterPassword &&
      userDecryptionOpts.trustedDeviceOption?.hasManageResetPasswordPermission
    ) {
      // If user doesn't have a MP, but has reset password permission, they must set a MP

      // Set flag so that auth guard can redirect to set password screen after decryption (trusted or untrusted device)
      // Note: we cannot directly navigate to the set password screen in this scenario as we are in a pre-decryption state, and
      // if you try to set a new MP before decrypting, you will invalidate the user's data by making a new user key.
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
        userId,
      );
    }

    this.twoFactorAuthComponentService.reloadOpenWindows?.();

    const inSingleActionPopoutWhichWasClosed =
      await this.twoFactorAuthComponentService.closeSingleActionPopouts?.();

    if (inSingleActionPopoutWhichWasClosed) {
      // No need to execute navigation as the single action popout was closed
      return;
    }

    await this.router.navigate(["login-initiated"]);
  }

  private async handleChangePasswordRequired(orgIdentifier: string | undefined) {
    const isSetInitialPasswordRefactorFlagOn = await this.configService.getFeatureFlag(
      FeatureFlag.PM16117_SetInitialPasswordRefactor,
    );
    const route = isSetInitialPasswordRefactorFlagOn ? "set-initial-password" : "set-password";

    await this.router.navigate([route], {
      queryParams: {
        identifier: orgIdentifier,
      },
    });
  }

  showContinueButton() {
    return (
      this.selectedProviderType != null &&
      this.selectedProviderType !== TwoFactorProviderType.WebAuthn &&
      this.selectedProviderType !== TwoFactorProviderType.Duo &&
      this.selectedProviderType !== TwoFactorProviderType.OrganizationDuo
    );
  }

  hideRememberMe() {
    // Don't show remember for me for scenarios where we have to popout the extension
    return (
      ((this.selectedProviderType === TwoFactorProviderType.Duo ||
        this.selectedProviderType === TwoFactorProviderType.OrganizationDuo) &&
        this.duoLaunchAction === DuoLaunchAction.SINGLE_ACTION_POPOUT) ||
      (this.selectedProviderType === TwoFactorProviderType.WebAuthn && this.webAuthInNewTab)
    );
  }

  async use2faRecoveryCode() {
    // TODO: PM-17696 eventually we should have a consolidated recover-2fa component as a follow up
    // so that we don't have to always open a new tab for non-web clients.
    const env = await firstValueFrom(this.environmentService.environment$);
    const webVault = env.getWebVaultUrl();
    this.platformUtilsService.launchUri(webVault + "/#/recover-2fa");
  }

  async handleEnterKeyPress() {
    // Each 2FA provider has a different implementation.
    // For example, email 2FA uses an input of type "text" for the token which does not automatically submit on enter.
    // Yubikey, however, uses an input with type "password" which does automatically submit on enter.
    // So we have to handle the enter key press differently for each provider.
    switch (this.selectedProviderType) {
      case TwoFactorProviderType.Authenticator:
      case TwoFactorProviderType.Email:
        // We must actually submit the form via click in order for the tokenFormControl value to be set.
        this.continueButton?.nativeElement?.click();
        break;
      case TwoFactorProviderType.Duo:
      case TwoFactorProviderType.OrganizationDuo:
      case TwoFactorProviderType.WebAuthn:
      case TwoFactorProviderType.Yubikey:
        // Do nothing
        break;
      default:
        this.logService.error(
          "handleEnterKeyPress: Unhandled 2FA provider type",
          this.selectedProviderType,
        );
        break;
    }
  }

  async ngOnDestroy() {
    this.twoFactorAuthComponentService.removePopupWidthExtension?.();
  }
}
