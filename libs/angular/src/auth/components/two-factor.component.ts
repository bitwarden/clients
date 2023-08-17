import { Directive, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { TwoFactorProviderType } from "@bitwarden/common/auth/enums/two-factor-provider-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceResetPasswordReason } from "@bitwarden/common/auth/models/domain/force-reset-password-reason";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { TwoFactorEmailRequest } from "@bitwarden/common/auth/models/request/two-factor-email.request";
import { TwoFactorProviders } from "@bitwarden/common/auth/services/two-factor.service";
import { WebAuthnIFrame } from "@bitwarden/common/auth/webauthn-iframe";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

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
  identifier: string = null;
  broadcastChannel: BroadcastChannel;
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;

  protected loginRoute = "login";
  protected successRoute = "vault";

  constructor(
    protected authService: AuthService,
    protected router: Router,
    protected i18nService: I18nService,
    protected apiService: ApiService,
    protected platformUtilsService: PlatformUtilsService,
    protected win: Window,
    protected environmentService: EnvironmentService,
    protected stateService: StateService,
    protected route: ActivatedRoute,
    protected logService: LogService,
    protected twoFactorService: TwoFactorService,
    protected appIdService: AppIdService,
    protected loginService: LoginService
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
        this.identifier = qParams.identifier;
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
        this.broadcastChannel = new BroadcastChannel("duo-broadcast");
        this.broadcastChannel.onmessage = (message) => {
          if (message.data.command && message.data.command === "duoResult") {
            // TODO: send code to server for validation
          }
        };

        this.platformUtilsService.launchUri(providerData.Host);
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
    const response: AuthResult = await this.formPromise;
    if (this.handleCaptchaRequired(response)) {
      return;
    }
    if (this.onSuccessfulLogin != null) {
      this.loginService.clearValues();
      // Note: awaiting this will currently cause a hang on desktop & browser as they will wait for a full sync to complete
      // before nagivating to the success route.
      this.onSuccessfulLogin();
    }
    if (response.resetMasterPassword) {
      this.successRoute = "set-password";
    }
    if (response.forcePasswordReset !== ForceResetPasswordReason.None) {
      this.successRoute = "update-temp-password";
    }
    if (this.onSuccessfulLoginNavigate != null) {
      this.loginService.clearValues();
      await this.onSuccessfulLoginNavigate();
    } else {
      this.loginService.clearValues();
      this.router.navigate([this.successRoute], {
        queryParams: {
          identifier: this.identifier,
        },
      });
    }
  }

  async sendEmail(doToast: boolean) {
    if (this.selectedProviderType !== TwoFactorProviderType.Email) {
      return;
    }

    if (this.emailPromise != null) {
      return;
    }

    try {
      const request = new TwoFactorEmailRequest();
      request.email = this.authService.email;
      request.masterPasswordHash = this.authService.masterPasswordHash;
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
