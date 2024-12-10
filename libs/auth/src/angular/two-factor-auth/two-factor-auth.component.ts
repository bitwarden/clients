// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, Inject, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, NavigationExtras, Router, RouterLink } from "@angular/router";
import { lastValueFrom, firstValueFrom } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  UserDecryptionOptionsServiceAbstraction,
  TrustedDeviceUserDecryptionOption,
  UserDecryptionOptions,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { TwoFactorProviders } from "@bitwarden/common/auth/services/two-factor.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { SyncService } from "@bitwarden/common/platform/sync";
import {
  AsyncActionsModule,
  ButtonModule,
  DialogService,
  FormFieldModule,
  ToastService,
} from "@bitwarden/components";

import { TwoFactorAuthAuthenticatorComponent } from "./child-components/two-factor-auth-authenticator.component";
import { TwoFactorAuthDuoComponent } from "./child-components/two-factor-auth-duo.component";
import { TwoFactorAuthEmailComponent } from "./child-components/two-factor-auth-email.component";
import { TwoFactorAuthWebAuthnComponent } from "./child-components/two-factor-auth-webauthn.component";
import { TwoFactorAuthYubikeyComponent } from "./child-components/two-factor-auth-yubikey.component";
import {
  LegacyKeyMigrationAction,
  TwoFactorAuthComponentService,
} from "./two-factor-auth-component.service";
import {
  TwoFactorOptionsDialogResult,
  TwoFactorOptionsComponent,
  TwoFactorOptionsDialogResultType,
} from "./two-factor-options.component";

@Component({
  standalone: true,
  selector: "app-two-factor-auth",
  templateUrl: "two-factor-auth.component.html",
  imports: [
    CommonModule,
    JslibModule,
    ReactiveFormsModule,
    FormFieldModule,
    AsyncActionsModule,
    RouterLink,
    ButtonModule,
    TwoFactorOptionsComponent, // used as dialog
    TwoFactorAuthAuthenticatorComponent,
    TwoFactorAuthEmailComponent,
    TwoFactorAuthDuoComponent,
    TwoFactorAuthYubikeyComponent,
    TwoFactorAuthWebAuthnComponent,
  ],
  providers: [I18nPipe],
})
export class TwoFactorAuthComponent implements OnInit, OnDestroy {
  token = "";
  remember = false;
  orgSsoIdentifier: string = null;

  providers = TwoFactorProviders;
  providerType = TwoFactorProviderType;
  selectedProviderType: TwoFactorProviderType = TwoFactorProviderType.Authenticator;
  providerData: any;

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
  actionButtonText = "";
  title = "";

  formPromise: Promise<any>;

  onSuccessfulLoginTde: () => Promise<void>;
  onSuccessfulLoginTdeNavigate: () => Promise<void>;

  submitForm = async () => {
    await this.submit();
  };

  private loginRoute = "login";
  private trustedDeviceEncRoute = "login-initiated";
  private changePasswordRoute = "set-password";
  private forcePasswordResetRoute = "update-temp-password";
  private twoFactorSessionTimeoutRoute = "2fa-timeout";

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
    private configService: ConfigService,
    private masterPasswordService: InternalMasterPasswordServiceAbstraction,
    private accountService: AccountService,
    private formBuilder: FormBuilder,
    @Inject(WINDOW) protected win: Window,
    private toastService: ToastService,
    private twoFactorAuthComponentService: TwoFactorAuthComponentService,
    private syncService: SyncService,
    private messagingService: MessagingService,
  ) {}

  async ngOnInit() {
    // TODO: should this be in a guard instead of here?
    const userIsAuthenticating = await this.userIsAuthenticating();
    const twoFactorProviders = await this.twoFactorService.getProviders();
    if (!userIsAuthenticating || twoFactorProviders == null) {
      await this.router.navigate([this.loginRoute]);
      return;
    }

    this.orgSsoIdentifier = this.activatedRoute.snapshot.queryParamMap.get("identifier");

    const webAuthnSupported = this.platformUtilsService.supportsWebAuthn(this.win);
    this.selectedProviderType = await this.twoFactorService.getDefaultProvider(webAuthnSupported);
    const providerData = await this.twoFactorService.getProviders().then((providers) => {
      return providers.get(this.selectedProviderType);
    });
    this.providerData = providerData;
    await this.setTitleByTwoFactorProvider();

    this.actionButtonText = this.i18nService.t("continue");

    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      this.token = value.token;
      this.remember = value.remember;
    });

    this.listenFor2faSessionTimeout();

    // TODO: this is a temporary on init. Must genericize this and refactor out client specific stuff where possible.
    await this.extensionOnInit();
  }

  private async extensionOnInit() {
    if (this.activatedRoute.snapshot.paramMap.has("webAuthnResponse")) {
      // WebAuthn fallback response
      this.selectedProviderType = TwoFactorProviderType.WebAuthn;
      this.token = this.activatedRoute.snapshot.paramMap.get("webAuthnResponse");
      // TODO: move this to service.
      // this.onSuccessfulLogin = async () => {
      //   this.messagingService.send("reloadPopup");
      //   window.close();
      // };
      this.remember = this.activatedRoute.snapshot.paramMap.get("remember") === "true";
      await this.submit();
      return;
    }

    // TODO: refactor into service
    // if (await BrowserPopupUtils.inPopout(this.win)) {
    //   this.selectedProviderType = TwoFactorProviderType.Email;
    // }

    // WebAuthn prompt appears inside the popup on linux, and requires a larger popup width
    // than usual to avoid cutting off the dialog.
    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && (await this.isLinux())) {
      document.body.classList.add("linux-webauthn");
    }
  }

  private listenFor2faSessionTimeout() {
    this.loginStrategyService.twoFactorTimeout$
      .pipe(takeUntilDestroyed())
      .subscribe(async (expired) => {
        if (!expired) {
          return;
        }

        try {
          await this.router.navigate([this.twoFactorSessionTimeoutRoute]);
        } catch (err) {
          this.logService.error(
            `Failed to navigate to ${this.twoFactorSessionTimeoutRoute} route`,
            err,
          );
        }
      });
  }

  async submit() {
    if (this.token == null || this.token === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("verificationCodeRequired"),
      });
      return;
    }

    try {
      this.formPromise = this.loginStrategyService.logInTwoFactor(
        new TokenTwoFactorRequest(this.selectedProviderType, this.token, this.remember),
        null,
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
  }

  async selectOtherTwofactorMethod() {
    const dialogRef = TwoFactorOptionsComponent.open(this.dialogService);
    const response: TwoFactorOptionsDialogResultType = await lastValueFrom(dialogRef.closed);
    if (response.result === TwoFactorOptionsDialogResult.Provider) {
      const providerData = await this.twoFactorService.getProviders().then((providers) => {
        return providers.get(response.type);
      });
      this.providerData = providerData;
      this.selectedProviderType = response.type;
      await this.setTitleByTwoFactorProvider();
    }
  }

  async launchDuo() {
    if (this.duoComponent != null) {
      await this.duoComponent.launchDuoFrameless();
    }
  }

  protected async handleMigrateEncryptionKey(result: AuthResult): Promise<boolean> {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }
    // Migration is forced so prevent login via return
    const legacyKeyMigrationAction: LegacyKeyMigrationAction =
      this.twoFactorAuthComponentService.determineLegacyKeyMigrationAction();

    switch (legacyKeyMigrationAction) {
      case LegacyKeyMigrationAction.NAVIGATE_TO_MIGRATION_COMPONENT:
        await this.router.navigate(["migrate-legacy-encryption"]);
        break;
      case LegacyKeyMigrationAction.PREVENT_LOGIN_AND_SHOW_REQUIRE_MIGRATION_WARNING:
        this.toastService.showToast({
          variant: "error",
          title: this.i18nService.t("errorOccured"),
          message: this.i18nService.t("encryptionKeyMigrationRequired"),
        });
        break;
    }
    return true;
  }

  async setTitleByTwoFactorProvider() {
    if (this.selectedProviderType == null) {
      this.title = this.i18nService.t("loginUnavailable");
      return;
    }

    this.title = (TwoFactorProviders as any)[this.selectedProviderType].name;
  }

  private async handleAuthResult(authResult: AuthResult) {
    if (await this.handleMigrateEncryptionKey(authResult)) {
      return; // stop login process
    }

    // User is fully logged in so we should sync before executing navigation
    await this.syncService.fullSync(true);
    this.loginEmailService.clearValues();

    // Save off the OrgSsoIdentifier for use in the TDE flows
    // - TDE login decryption options component
    // - Browser SSO on extension open
    await this.ssoLoginService.setActiveUserOrganizationSsoIdentifier(this.orgSsoIdentifier);

    // note: this flow affects both TDE & standard users
    if (this.isForcePasswordResetRequired(authResult)) {
      return await this.handleForcePasswordReset(this.orgSsoIdentifier);
    }

    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );

    const tdeEnabled = await this.isTrustedDeviceEncEnabled(userDecryptionOpts.trustedDeviceOption);

    if (tdeEnabled) {
      return await this.handleTrustedDeviceEncryptionEnabled(
        authResult,
        this.orgSsoIdentifier,
        userDecryptionOpts,
      );
    }

    // User must set password if they don't have one and they aren't using either TDE or key connector.
    const requireSetPassword =
      !userDecryptionOpts.hasMasterPassword && userDecryptionOpts.keyConnectorOption === undefined;

    if (requireSetPassword || authResult.resetMasterPassword) {
      // Change implies going no password -> password in this case
      return await this.handleChangePasswordRequired(this.orgSsoIdentifier);
    }

    const defaultSuccessRoute = await this.determineDefaultSuccessRoute();

    await this.router.navigate([defaultSuccessRoute], {
      queryParams: {
        identifier: this.orgSsoIdentifier,
      },
    });
  }

  private async determineDefaultSuccessRoute(): Promise<string> {
    const authType = await firstValueFrom(this.loginStrategyService.currentAuthType$);
    if (authType == AuthenticationType.Sso || authType == AuthenticationType.UserApiKey) {
      return "lock";
    }

    return "vault";
  }

  private async isTrustedDeviceEncEnabled(
    trustedDeviceOption: TrustedDeviceUserDecryptionOption,
  ): Promise<boolean> {
    const ssoTo2faFlowActive = this.activatedRoute.snapshot.queryParamMap.get("sso") === "true";

    return ssoTo2faFlowActive && trustedDeviceOption !== undefined;
  }

  private async handleTrustedDeviceEncryptionEnabled(
    authResult: AuthResult,
    orgIdentifier: string,
    userDecryptionOpts: UserDecryptionOptions,
  ): Promise<void> {
    // If user doesn't have a MP, but has reset password permission, they must set a MP
    if (
      !userDecryptionOpts.hasMasterPassword &&
      userDecryptionOpts.trustedDeviceOption.hasManageResetPasswordPermission
    ) {
      // Set flag so that auth guard can redirect to set password screen after decryption (trusted or untrusted device)
      // Note: we cannot directly navigate to the set password screen in this scenario as we are in a pre-decryption state, and
      // if you try to set a new MP before decrypting, you will invalidate the user's data by making a new user key.
      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
      await this.masterPasswordService.setForceSetPasswordReason(
        ForceSetPasswordReason.TdeUserWithoutPasswordHasPasswordResetPermission,
        userId,
      );
    }

    if (this.onSuccessfulLoginTde != null) {
      // Note: awaiting this will currently cause a hang on desktop & browser as they will wait for a full sync to complete
      // before navigating to the success route.
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.onSuccessfulLoginTde();
    }

    // TODO: extension has this.onSuccessfulLoginTdeNavigate = async () => {
    //   this.win.close();
    // };

    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.navigateViaCallbackOrRoute(
      this.onSuccessfulLoginTdeNavigate,
      // Navigate to TDE page (if user was on trusted device and TDE has decrypted
      //  their user key, the login-initiated guard will redirect them to the vault)
      [this.trustedDeviceEncRoute],
    );
  }

  private async handleChangePasswordRequired(orgIdentifier: string) {
    await this.router.navigate([this.changePasswordRoute], {
      queryParams: {
        identifier: orgIdentifier,
      },
    });
  }

  /**
   * Determines if a user needs to reset their password based on certain conditions.
   * Users can be forced to reset their password via an admin or org policy disallowing weak passwords.
   * Note: this is different from the SSO component login flow as a user can
   * login with MP and then have to pass 2FA to finish login and we can actually
   * evaluate if they have a weak password at that time.
   *
   * @param {AuthResult} authResult - The authentication result.
   * @returns {boolean} Returns true if a password reset is required, false otherwise.
   */
  private isForcePasswordResetRequired(authResult: AuthResult): boolean {
    const forceResetReasons = [
      ForceSetPasswordReason.AdminForcePasswordReset,
      ForceSetPasswordReason.WeakMasterPassword,
    ];

    return forceResetReasons.includes(authResult.forcePasswordReset);
  }

  private async handleForcePasswordReset(orgIdentifier: string) {
    // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.router.navigate([this.forcePasswordResetRoute], {
      queryParams: {
        identifier: orgIdentifier,
      },
    });
  }

  private async navigateViaCallbackOrRoute(
    callback: () => Promise<unknown>,
    commands: unknown[],
    extras?: NavigationExtras,
  ): Promise<void> {
    if (callback) {
      await callback();
    } else {
      await this.router.navigate(commands, extras);
    }
  }

  private async userIsAuthenticating(): Promise<boolean> {
    return (await firstValueFrom(this.loginStrategyService.currentAuthType$)) !== null;
  }

  async isLinux() {
    // TODO: this was extension logic and must be moved to service if platform utils service doesn't have support for this
    // return (await BrowserApi.getPlatformInfo()).os === "linux";
    return false;
  }

  async ngOnDestroy() {
    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && (await this.isLinux())) {
      document.body.classList.remove("linux-webauthn");
    }
  }
}
