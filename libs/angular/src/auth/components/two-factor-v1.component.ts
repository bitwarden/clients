// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Directive, Inject, OnInit, OnDestroy } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { first } from "rxjs/operators";

// eslint-disable-next-line no-restricted-imports
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import {
  LoginStrategyServiceAbstraction,
  LoginEmailServiceAbstraction,
  TrustedDeviceUserDecryptionOption,
  UserDecryptionOptions,
  UserDecryptionOptionsServiceAbstraction,
} from "@bitwarden/auth/common";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { InternalMasterPasswordServiceAbstraction } from "@bitwarden/common/auth/abstractions/master-password.service.abstraction";
import { SsoLoginServiceAbstraction } from "@bitwarden/common/auth/abstractions/sso-login.service.abstraction";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { TwoFactorProviders } from "@bitwarden/common/auth/services/two-factor.service";
import { WebAuthnIFrame } from "@bitwarden/common/auth/webauthn-iframe";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ToastService } from "@bitwarden/components";

import { CaptchaProtectedComponent } from "./captcha-protected.component";

@Directive()
export class TwoFactorComponentV1 extends CaptchaProtectedComponent implements OnInit, OnDestroy {
  token = "";
  remember = false;
  webAuthnReady = false;
  webAuthnNewTab = false;
  providers = TwoFactorProviders;
  providerType = TwoFactorProviderType;
  selectedProviderType: TwoFactorProviderType = TwoFactorProviderType.Authenticator;
  webAuthnSupported = false;
  webAuthn: WebAuthnIFrame = null;
  title = "";
  twoFactorEmail: string = null;
  formPromise: Promise<any>;
  emailPromise: Promise<any>;
  orgIdentifier: string = null;

  duoFramelessUrl: string = null;
  duoResultListenerInitialized = false;

  onSuccessfulLogin: () => Promise<void>;
  onSuccessfulLoginNavigate: () => Promise<void>;

  onSuccessfulLoginTde: () => Promise<void>;
  onSuccessfulLoginTdeNavigate: () => Promise<void>;

  protected loginRoute = "login";

  protected trustedDeviceEncRoute = "login-initiated";
  protected changePasswordRoute = "set-password";
  protected forcePasswordResetRoute = "update-temp-password";
  protected successRoute = "vault";
  protected twoFactorTimeoutRoute = "authentication-timeout";

  get isDuoProvider(): boolean {
    return (
      this.selectedProviderType === TwoFactorProviderType.Duo ||
      this.selectedProviderType === TwoFactorProviderType.OrganizationDuo
    );
  }

  constructor(
    protected loginStrategyService: LoginStrategyServiceAbstraction,
    protected router: Router,
    protected i18nService: I18nService,
    protected apiService: ApiService,
    protected platformUtilsService: PlatformUtilsService,
    @Inject(WINDOW) protected win: Window,
    protected environmentService: EnvironmentService,
    protected stateService: StateService,
    protected route: ActivatedRoute,
    protected logService: LogService,
    protected twoFactorService: TwoFactorService,
    protected appIdService: AppIdService,
    protected loginEmailService: LoginEmailServiceAbstraction,
    protected userDecryptionOptionsService: UserDecryptionOptionsServiceAbstraction,
    protected ssoLoginService: SsoLoginServiceAbstraction,
    protected configService: ConfigService,
    protected masterPasswordService: InternalMasterPasswordServiceAbstraction,
    protected accountService: AccountService,
    protected toastService: ToastService,
  ) {
    super(environmentService, i18nService, platformUtilsService, toastService);

    this.webAuthnSupported = this.platformUtilsService.supportsWebAuthn(win);

    // Add subscription to authenticationSessionTimeout$ and navigate to twoFactorTimeoutRoute if expired
    this.loginStrategyService.authenticationSessionTimeout$
      .pipe(takeUntilDestroyed())
      .subscribe(async (expired) => {
        if (!expired) {
          return;
        }

        try {
          await this.router.navigate([this.twoFactorTimeoutRoute]);
        } catch (err) {
          this.logService.error(`Failed to navigate to ${this.twoFactorTimeoutRoute} route`, err);
        }
      });
  }

  async ngOnInit() {
    if (!(await this.authing()) || (await this.twoFactorService.getProviders()) == null) {
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.router.navigate([this.loginRoute]);
      return;
    }

    this.route.queryParams.pipe(first()).subscribe((qParams) => {
      if (qParams.identifier != null) {
        this.orgIdentifier = qParams.identifier;
      }
    });

    if (await this.needsLock()) {
      this.successRoute = "lock";
    }

    if (this.win != null && this.webAuthnSupported) {
      const env = await firstValueFrom(this.environmentService.environment$);
      const webVaultUrl = env.getWebVaultUrl();
      this.webAuthn = new WebAuthnIFrame(
        this.win,
        webVaultUrl,
        this.webAuthnNewTab,
        this.platformUtilsService,
        this.i18nService,
        (token: string) => {
          this.token = token;
          // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
          // eslint-disable-next-line @typescript-eslint/no-floating-promises
          this.submit();
        },
        (error: string) => {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("errorOccurred"),
            message: this.i18nService.t("webauthnCancelOrTimeout"),
          });
        },
        (info: string) => {
          if (info === "ready") {
            this.webAuthnReady = true;
          }
        },
      );
    }

    this.selectedProviderType = await this.twoFactorService.getDefaultProvider(
      this.webAuthnSupported,
    );
    await this.init();
  }

  ngOnDestroy(): void {
    this.cleanupWebAuthn();
    this.webAuthn = null;
  }

  async init() {
    if (this.selectedProviderType == null) {
      this.title = this.i18nService.t("loginUnavailable");
      return;
    }

    this.cleanupWebAuthn();
    this.title = (TwoFactorProviders as any)[this.selectedProviderType].name;
    const providerData = await this.twoFactorService.getProviders().then((providers) => {
      return providers.get(this.selectedProviderType);
    });
    switch (this.selectedProviderType) {
      case TwoFactorProviderType.WebAuthn:
        if (!this.webAuthnNewTab) {
          setTimeout(async () => {
            await this.authWebAuthn();
          }, 500);
        }
        break;
      case TwoFactorProviderType.Duo:
      case TwoFactorProviderType.OrganizationDuo:
        // Setup listener for duo-redirect.ts connector to send back the code
        if (!this.duoResultListenerInitialized) {
          // setup client specific duo result listener
          this.setupDuoResultListener();
          this.duoResultListenerInitialized = true;
        }
        // flow must be launched by user so they can choose to remember the device or not.
        this.duoFramelessUrl = providerData.AuthUrl;
        break;
      case TwoFactorProviderType.Email:
        this.twoFactorEmail = providerData.Email;
        if ((await this.twoFactorService.getProviders()).size > 1) {
          await this.sendEmail(false);
        }
        break;
      default:
        break;
    }
  }

  async submit() {
    await this.setupCaptcha();

    if (this.token == null || this.token === "") {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("verificationCodeRequired"),
      });
      return;
    }

    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn) {
      if (this.webAuthn != null) {
        this.webAuthn.stop();
      } else {
        return;
      }
    } else if (
      this.selectedProviderType === TwoFactorProviderType.Email ||
      this.selectedProviderType === TwoFactorProviderType.Authenticator
    ) {
      this.token = this.token.replace(" ", "").trim();
    }

    await this.doSubmit();
    if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && this.webAuthn != null) {
      this.webAuthn.start();
    }
  }

  async doSubmit() {
    this.formPromise = this.loginStrategyService.logInTwoFactor(
      new TokenTwoFactorRequest(this.selectedProviderType, this.token, this.remember),
      this.captchaToken,
    );
    const authResult: AuthResult = await this.formPromise;

    await this.handleLoginResponse(authResult);
  }

  protected handleMigrateEncryptionKey(result: AuthResult): boolean {
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

  // Each client will have own implementation
  protected setupDuoResultListener(): void {}

  private async handleLoginResponse(authResult: AuthResult) {
    if (this.handleCaptchaRequired(authResult)) {
      return;
    } else if (this.handleMigrateEncryptionKey(authResult)) {
      return;
    }

    // Save off the OrgSsoIdentifier for use in the TDE flows
    // - TDE login decryption options component
    // - Browser SSO on extension open
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    await this.ssoLoginService.setActiveUserOrganizationSsoIdentifier(this.orgIdentifier, userId);
    this.loginEmailService.clearValues();

    // note: this flow affects both TDE & standard users
    if (this.isForcePasswordResetRequired(authResult)) {
      return await this.handleForcePasswordReset(this.orgIdentifier);
    }

    const userDecryptionOpts = await firstValueFrom(
      this.userDecryptionOptionsService.userDecryptionOptions$,
    );

    const tdeEnabled = await this.isTrustedDeviceEncEnabled(userDecryptionOpts.trustedDeviceOption);

    if (tdeEnabled) {
      return await this.handleTrustedDeviceEncryptionEnabled(
        authResult,
        this.orgIdentifier,
        userDecryptionOpts,
      );
    }

    // User must set password if they don't have one and they aren't using either TDE or key connector.
    const requireSetPassword =
      !userDecryptionOpts.hasMasterPassword && userDecryptionOpts.keyConnectorOption === undefined;

    if (requireSetPassword || authResult.resetMasterPassword) {
      // Change implies going no password -> password in this case
      return await this.handleChangePasswordRequired(this.orgIdentifier);
    }

    return await this.handleSuccessfulLogin();
  }

  private async isTrustedDeviceEncEnabled(
    trustedDeviceOption: TrustedDeviceUserDecryptionOption,
  ): Promise<boolean> {
    const ssoTo2faFlowActive = this.route.snapshot.queryParamMap.get("sso") === "true";

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

  private async handleSuccessfulLogin() {
    if (this.onSuccessfulLogin != null) {
      // Note: awaiting this will currently cause a hang on desktop & browser as they will wait for a full sync to complete
      // before navigating to the success route.
      // FIXME: Verify that this floating promise is intentional. If it is, add an explanatory comment and ensure there is proper error handling.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.onSuccessfulLogin();
    }
    await this.navigateViaCallbackOrRoute(this.onSuccessfulLoginNavigate, [this.successRoute]);
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

  async sendEmail(doToast: boolean) {
    if (this.selectedProviderType !== TwoFactorProviderType.Email) {
      return;
    }

    if (this.emailPromise != null) {
      return;
    }

    if ((await this.loginStrategyService.getEmail()) == null) {
      this.toastService.showToast({
        variant: "error",
        title: this.i18nService.t("errorOccurred"),
        message: this.i18nService.t("sessionTimeout"),
      });
      return;
    }

    try {
      const request = new TwoFactorEmailRequest();
      request.email = await this.loginStrategyService.getEmail();
      request.masterPasswordHash = await this.loginStrategyService.getMasterPasswordHash();
      request.ssoEmail2FaSessionToken =
        await this.loginStrategyService.getSsoEmail2FaSessionToken();
      request.deviceIdentifier = await this.appIdService.getAppId();
      request.authRequestAccessCode = await this.loginStrategyService.getAccessCode();
      request.authRequestId = await this.loginStrategyService.getAuthRequestId();
      this.emailPromise = this.apiService.postTwoFactorEmail(request);
      await this.emailPromise;
      if (doToast) {
        this.toastService.showToast({
          variant: "success",
          title: null,
          message: this.i18nService.t("verificationCodeEmailSent", this.twoFactorEmail),
        });
      }
    } catch (e) {
      this.logService.error(e);
    }

    this.emailPromise = null;
  }

  async authWebAuthn() {
    const providerData = await this.twoFactorService.getProviders().then((providers) => {
      return providers.get(this.selectedProviderType);
    });

    if (!this.webAuthnSupported || this.webAuthn == null) {
      return;
    }

    this.webAuthn.init(providerData);
  }

  private cleanupWebAuthn() {
    if (this.webAuthn != null) {
      this.webAuthn.stop();
      this.webAuthn.cleanup();
    }
  }

  private async authing(): Promise<boolean> {
    return (await firstValueFrom(this.loginStrategyService.currentAuthType$)) !== null;
  }

  private async needsLock(): Promise<boolean> {
    const authType = await firstValueFrom(this.loginStrategyService.currentAuthType$);
    return authType == AuthenticationType.Sso || authType == AuthenticationType.UserApiKey;
  }

  async launchDuoFrameless() {
    if (this.duoFramelessUrl === null) {
      this.toastService.showToast({
        variant: "error",
        title: null,
        message: this.i18nService.t("duoHealthCheckResultsInNullAuthUrlError"),
      });
      return;
    }

    this.platformUtilsService.launchUri(this.duoFramelessUrl);
  }
}
