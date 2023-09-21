import { Directive, Inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, NavigationExtras, Router } from "@angular/router";
import * as DuoWebSDK from "duo_web_sdk";
import { first } from "rxjs/operators";

// eslint-disable-next-line no-restricted-imports
import { WINDOW } from "@bitwarden/angular/services/injection-tokens";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceResetPasswordReason } from "@bitwarden/common/auth/models/domain/force-reset-password-reason";
import { TrustedDeviceUserDecryptionOption } from "@bitwarden/common/auth/models/domain/user-decryption-options/trusted-device-user-decryption-option";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { TwoFactorProviders } from "@bitwarden/common/auth/services/two-factor.service";
import { WebAuthnIFrame } from "@bitwarden/common/auth/webauthn-iframe";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigServiceAbstraction } from "@bitwarden/common/platform/abstractions/config/config.service.abstraction";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { AccountDecryptionOptions } from "@bitwarden/common/platform/models/domain/account";

import { CaptchaProtectedComponent } from "./captcha-protected.component";

@Directive()
export class TwoFactorComponent extends CaptchaProtectedComponent implements OnInit, OnDestroy {
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
  onSuccessfulLogin: () => Promise<void>;
  onSuccessfulLoginNavigate: () => Promise<void>;

  onSuccessfulLoginTde: () => Promise<void>;
  onSuccessfulLoginTdeNavigate: () => Promise<void>;

  protected loginRoute = "login";

  protected trustedDeviceEncRoute = "login-initiated";
  protected changePasswordRoute = "set-password";
  protected forcePasswordResetRoute = "update-temp-password";
  protected successRoute = "vault";

  constructor(
    protected authService: AuthService,
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
    protected loginService: LoginService,
    protected configService: ConfigServiceAbstraction
  ) {
    super(environmentService, i18nService, platformUtilsService);
    this.webAuthnSupported = this.platformUtilsService.supportsWebAuthn(win);
  }

  async ngOnInit() {
    if (!this.authing || this.twoFactorService.getProviders() == null) {
      this.router.navigate([this.loginRoute]);
      return;
    }

    this.route.queryParams.pipe(first()).subscribe((qParams) => {
      if (qParams.identifier != null) {
        this.orgIdentifier = qParams.identifier;
      }
    });

    if (this.needsLock) {
      this.successRoute = "lock";
    }

    if (this.win != null && this.webAuthnSupported) {
      const webVaultUrl = this.environmentService.getWebVaultUrl();
      this.webAuthn = new WebAuthnIFrame(
        this.win,
        webVaultUrl,
        this.webAuthnNewTab,
        this.platformUtilsService,
        this.i18nService,
        (token: string) => {
          this.token = token;
          this.submit();
        },
        (error: string) => {
          this.platformUtilsService.showToast("error", this.i18nService.t("errorOccurred"), error);
        },
        (info: string) => {
          if (info === "ready") {
            this.webAuthnReady = true;
          }
        }
      );
    }

    this.selectedProviderType = this.twoFactorService.getDefaultProvider(this.webAuthnSupported);
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
    const providerData = this.twoFactorService.getProviders().get(this.selectedProviderType);
    switch (this.selectedProviderType) {
      case TwoFactorProviderType.WebAuthn:
        if (!this.webAuthnNewTab) {
          setTimeout(() => {
            this.authWebAuthn();
          }, 500);
        }
        break;
      case TwoFactorProviderType.Duo:
      case TwoFactorProviderType.OrganizationDuo:
        setTimeout(() => {
          DuoWebSDK.init({
            iframe: undefined,
            host: providerData.Host,
            sig_request: providerData.Signature,
            submit_callback: async (f: HTMLFormElement) => {
              const sig = f.querySelector('input[name="sig_response"]') as HTMLInputElement;
              if (sig != null) {
                this.token = sig.value;
                await this.submit();
              }
            },
          });
        }, 0);
        break;
      case TwoFactorProviderType.Email:
        this.twoFactorEmail = providerData.Email;
        if (this.twoFactorService.getProviders().size > 1) {
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
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("verificationCodeRequired")
      );
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

    try {
      await this.doSubmit();
    } catch {
      if (this.selectedProviderType === TwoFactorProviderType.WebAuthn && this.webAuthn != null) {
        this.webAuthn.start();
      }
    }
  }

  async doSubmit() {
    this.formPromise = this.authService.logInTwoFactor(
      new TokenTwoFactorRequest(this.selectedProviderType, this.token, this.remember),
      this.captchaToken
    );
    const authResult: AuthResult = await this.formPromise;

    await this.handleLoginResponse(authResult);
  }

  protected handleMigrateEncryptionKey(result: AuthResult): boolean {
    if (!result.requiresEncryptionKeyMigration) {
      return false;
    }

    this.platformUtilsService.showToast(
      "error",
      this.i18nService.t("errorOccured"),
      this.i18nService.t("encryptionKeyMigrationRequired")
    );
    return true;
  }

  private async handleLoginResponse(authResult: AuthResult) {
    if (this.handleCaptchaRequired(authResult)) {
      return;
    } else if (this.handleMigrateEncryptionKey(authResult)) {
      return;
    }

    this.loginService.clearValues();

    const acctDecryptionOpts: AccountDecryptionOptions =
      await this.stateService.getAccountDecryptionOptions();

    const tdeEnabled = await this.isTrustedDeviceEncEnabled(acctDecryptionOpts.trustedDeviceOption);

    if (tdeEnabled) {
      return await this.handleTrustedDeviceEncryptionEnabled(
        authResult,
        this.orgIdentifier,
        acctDecryptionOpts
      );
    }

    // User must set password if they don't have one and they aren't using either TDE or key connector.
    const requireSetPassword =
      !acctDecryptionOpts.hasMasterPassword && acctDecryptionOpts.keyConnectorOption === undefined;

    if (requireSetPassword || authResult.resetMasterPassword) {
      // Change implies going no password -> password in this case
      return await this.handleChangePasswordRequired(this.orgIdentifier);
    }

    // Users can be forced to reset their password via an admin or org policy
    // disallowing weak passwords
    if (authResult.forcePasswordReset !== ForceResetPasswordReason.None) {
      return await this.handleForcePasswordReset(this.orgIdentifier);
    }

    return await this.handleSuccessfulLogin();
  }

  private async isTrustedDeviceEncEnabled(
    trustedDeviceOption: TrustedDeviceUserDecryptionOption
  ): Promise<boolean> {
    const ssoTo2faFlowActive = this.route.snapshot.queryParamMap.get("sso") === "true";
    const trustedDeviceEncryptionFeatureActive = await this.configService.getFeatureFlag<boolean>(
      FeatureFlag.TrustedDeviceEncryption
    );

    return (
      ssoTo2faFlowActive &&
      trustedDeviceEncryptionFeatureActive &&
      trustedDeviceOption !== undefined
    );
  }

  private async handleTrustedDeviceEncryptionEnabled(
    authResult: AuthResult,
    orgIdentifier: string,
    acctDecryptionOpts: AccountDecryptionOptions
  ): Promise<void> {
    // If user doesn't have a MP, but has reset password permission, they must set a MP
    if (
      !acctDecryptionOpts.hasMasterPassword &&
      acctDecryptionOpts.trustedDeviceOption.hasManageResetPasswordPermission
    ) {
      // Change implies going no password -> password in this case
      return await this.handleChangePasswordRequired(orgIdentifier);
    }

    // Users can be forced to reset their password via an admin or org policy disallowing weak passwords
    // Note: this is different from SSO component login flow as a user can
    // login with MP and then have to pass 2FA to finish login and we can actually
    // evaluate if they have a weak password at this time.
    if (authResult.forcePasswordReset !== ForceResetPasswordReason.None) {
      return await this.handleForcePasswordReset(orgIdentifier);
    }

    if (this.onSuccessfulLoginTde != null) {
      // Note: awaiting this will currently cause a hang on desktop & browser as they will wait for a full sync to complete
      // before navigating to the success route.
      this.onSuccessfulLoginTde();
    }

    this.navigateViaCallbackOrRoute(
      this.onSuccessfulLoginTdeNavigate,
      // Navigate to TDE page (if user was on trusted device and TDE has decrypted
      //  their user key, the login-initiated guard will redirect them to the vault)
      [this.trustedDeviceEncRoute]
    );
  }

  private async handleChangePasswordRequired(orgIdentifier: string) {
    await this.router.navigate([this.changePasswordRoute], {
      queryParams: {
        identifier: orgIdentifier,
      },
    });
  }

  private async handleForcePasswordReset(orgIdentifier: string) {
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
      this.onSuccessfulLogin();
    }
    await this.navigateViaCallbackOrRoute(this.onSuccessfulLoginNavigate, [this.successRoute]);
  }

  private async navigateViaCallbackOrRoute(
    callback: () => Promise<unknown>,
    commands: unknown[],
    extras?: NavigationExtras
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

    if (this.authService.email == null) {
      this.platformUtilsService.showToast(
        "error",
        this.i18nService.t("errorOccurred"),
        this.i18nService.t("sessionTimeout")
      );
      return;
    }

    try {
      const request = new TwoFactorEmailRequest();
      request.email = this.authService.email;
      request.masterPasswordHash = this.authService.masterPasswordHash;
      request.ssoEmail2FaSessionToken = this.authService.ssoEmail2FaSessionToken;
      request.deviceIdentifier = await this.appIdService.getAppId();
      request.authRequestAccessCode = this.authService.accessCode;
      request.authRequestId = this.authService.authRequestId;
      this.emailPromise = this.apiService.postTwoFactorEmail(request);
      await this.emailPromise;
      if (doToast) {
        this.platformUtilsService.showToast(
          "success",
          null,
          this.i18nService.t("verificationCodeEmailSent", this.twoFactorEmail)
        );
      }
    } catch (e) {
      this.logService.error(e);
    }

    this.emailPromise = null;
  }

  authWebAuthn() {
    const providerData = this.twoFactorService.getProviders().get(this.selectedProviderType);

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

  get authing(): boolean {
    return (
      this.authService.authingWithPassword() ||
      this.authService.authingWithSso() ||
      this.authService.authingWithUserApiKey() ||
      this.authService.authingWithPasswordless()
    );
  }

  get needsLock(): boolean {
    return this.authService.authingWithSso() || this.authService.authingWithUserApiKey();
  }
}
