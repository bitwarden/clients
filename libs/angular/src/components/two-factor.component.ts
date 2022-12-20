import { Directive, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import * as DuoWebSDK from "duo_web_sdk";
import { first } from "rxjs/operators";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AppIdService } from "@bitwarden/common/abstractions/appId.service";
import { AuthService } from "@bitwarden/common/abstractions/auth.service";
import { EnvironmentService } from "@bitwarden/common/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/abstractions/log.service";
import { LoginService } from "@bitwarden/common/abstractions/login.service";
import { PlatformUtilsService } from "@bitwarden/common/abstractions/platformUtils.service";
import { StateService } from "@bitwarden/common/abstractions/state.service";
import { TwoFactorService } from "@bitwarden/common/abstractions/twoFactor.service";
import { TwoFactorProviderType } from "@bitwarden/common/enums/twoFactorProviderType";
import { Utils } from "@bitwarden/common/misc/utils";
import { WebAuthnIFrame } from "@bitwarden/common/misc/webauthn_iframe";
import { AuthResult } from "@bitwarden/common/models/domain/auth-result";
import { TokenTwoFactorRequest } from "@bitwarden/common/models/request/identity-token/token-two-factor.request";
import { TwoFactorEmailRequest } from "@bitwarden/common/models/request/two-factor-email.request";
import { TwoFactorProviders } from "@bitwarden/common/services/twoFactor.service";

@Directive()
export class TwoFactorComponent implements OnInit, OnDestroy {
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
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;

  get webAuthnAllow(): string {
    return `publickey-credentials-get ${this.environmentService.getWebVaultUrl()}`;
  }

  protected loginRoute = "login";
  protected successRoute = "vault";

  protected captchaSiteKey?: string;
  protected captchaToken?: string;

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
    try {
      this.formPromise = this.authService.logInTwoFactor(
        new TokenTwoFactorRequest(this.selectedProviderType, this.token, this.remember),
        this.captchaToken
      );
      const response: AuthResult = await this.formPromise;
      const disableFavicon = await this.stateService.getDisableFavicon();
      await this.stateService.setDisableFavicon(!!disableFavicon);
      if (!Utils.isNullOrWhitespace(response.captchaSiteKey)) {
        this.captchaSiteKey = response.captchaSiteKey;
        return;
      }
      if (this.onSuccessfulLogin != null) {
        this.loginService.clearValues();
        this.onSuccessfulLogin();
      }
      if (response.resetMasterPassword) {
        this.successRoute = "set-password";
      }
      if (response.forcePasswordReset) {
        this.successRoute = "update-temp-password";
      }
      if (this.onSuccessfulLoginNavigate != null) {
        this.loginService.clearValues();
        this.onSuccessfulLoginNavigate();
      } else {
        this.loginService.clearValues();
        this.router.navigate([this.successRoute], {
          queryParams: {
            identifier: this.identifier,
          },
        });
      }
    } catch (e) {
      this.logService.debug(e);

      // Invalidate the captcha
      this.captchaToken = undefined;
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

  protected setCaptchaToken(token: string) {
    this.captchaToken = token;
    this.submit();
  }
}
