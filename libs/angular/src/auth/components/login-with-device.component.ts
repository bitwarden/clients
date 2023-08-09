import { Directive, OnDestroy, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { AnonymousHubService } from "@bitwarden/common/abstractions/anonymousHub.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { AuthRequestType } from "@bitwarden/common/auth/enums/auth-request-type";
import { ForceResetPasswordReason } from "@bitwarden/common/auth/models/domain/force-reset-password-reason";
import { PasswordlessLogInCredentials } from "@bitwarden/common/auth/models/domain/log-in-credentials";
import { PasswordlessCreateAuthRequest } from "@bitwarden/common/auth/models/request/passwordless-create-auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

import { CaptchaProtectedComponent } from "./captcha-protected.component";

@Directive()
export class LoginWithDeviceComponent
  extends CaptchaProtectedComponent
  implements OnInit, OnDestroy
{
  private destroy$ = new Subject<void>();
  email: string;
  showResendNotification = false;
  passwordlessRequest: PasswordlessCreateAuthRequest;
  fingerprintPhrase: string;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;
  onSuccessfulLoginForceResetNavigate: () => Promise<any>;

  protected twoFactorRoute = "2fa";
  protected successRoute = "vault";
  protected forcePasswordResetRoute = "update-temp-password";
  private resendTimeout = 12000;
  private authRequestKeyPair: [publicKey: Uint8Array, privateKey: Uint8Array];

  constructor(
    protected router: Router,
    private cryptoService: CryptoService,
    private cryptoFunctionService: CryptoFunctionService,
    private appIdService: AppIdService,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private apiService: ApiService,
    private authService: AuthService,
    private logService: LogService,
    environmentService: EnvironmentService,
    i18nService: I18nService,
    platformUtilsService: PlatformUtilsService,
    private anonymousHubService: AnonymousHubService,
    private validationService: ValidationService,
    private stateService: StateService,
    private loginService: LoginService
  ) {
    super(environmentService, i18nService, platformUtilsService);

    const navigation = this.router.getCurrentNavigation();
    if (navigation) {
      this.email = this.loginService.getEmail();
    }

    //gets signalR push notification
    this.authService
      .getPushNotificationObs$()
      .pipe(takeUntil(this.destroy$))
      .subscribe((id) => {
        this.confirmResponse(id);
      });
  }

  async ngOnInit() {
    if (!this.email) {
      this.router.navigate(["/login"]);
      return;
    }

    this.startPasswordlessLogin();
  }

  async startPasswordlessLogin() {
    this.showResendNotification = false;

    try {
      await this.buildAuthRequest();
      const reqResponse = await this.apiService.postAuthRequest(this.passwordlessRequest);

      if (reqResponse.id) {
        this.anonymousHubService.createHubConnection(reqResponse.id);
      }
    } catch (e) {
      this.logService.error(e);
    }

    setTimeout(() => {
      this.showResendNotification = true;
    }, this.resendTimeout);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.anonymousHubService.stopHubConnection();
  }

  private async confirmResponse(requestId: string) {
    try {
      const response = await this.apiService.getAuthResponse(
        requestId,
        this.passwordlessRequest.accessCode
      );

      if (!response.requestApproved) {
        return;
      }

      const credentials = await this.buildLoginCredentials(requestId, response);
      const loginResponse = await this.authService.logIn(credentials);

      if (loginResponse.requiresTwoFactor) {
        if (this.onSuccessfulLoginTwoFactorNavigate != null) {
          this.onSuccessfulLoginTwoFactorNavigate();
        } else {
          this.router.navigate([this.twoFactorRoute]);
        }
      } else if (loginResponse.forcePasswordReset != ForceResetPasswordReason.None) {
        if (this.onSuccessfulLoginForceResetNavigate != null) {
          this.onSuccessfulLoginForceResetNavigate();
        } else {
          this.router.navigate([this.forcePasswordResetRoute]);
        }
      } else {
        await this.setRememberEmailValues();
        if (this.onSuccessfulLogin != null) {
          this.onSuccessfulLogin();
        }
        if (this.onSuccessfulLoginNavigate != null) {
          this.onSuccessfulLoginNavigate();
        } else {
          this.router.navigate([this.successRoute]);
        }
      }
    } catch (error) {
      if (error instanceof ErrorResponse) {
        this.router.navigate(["/login"]);
        this.validationService.showError(error);
        return;
      }

      this.logService.error(error);
    }
  }

  async setRememberEmailValues() {
    const rememberEmail = this.loginService.getRememberEmail();
    const rememberedEmail = this.loginService.getEmail();
    await this.stateService.setRememberedEmail(rememberEmail ? rememberedEmail : null);
    this.loginService.clearValues();
  }

  private async buildAuthRequest() {
    this.authRequestKeyPair = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);
    const deviceIdentifier = await this.appIdService.getAppId();
    const publicKey = Utils.fromBufferToB64(this.authRequestKeyPair[0]);
    const accessCode = await this.passwordGenerationService.generatePassword({ length: 25 });

    this.fingerprintPhrase = (
      await this.cryptoService.getFingerprint(this.email, this.authRequestKeyPair[0])
    ).join("-");

    this.passwordlessRequest = new PasswordlessCreateAuthRequest(
      this.email,
      deviceIdentifier,
      publicKey,
      AuthRequestType.AuthenticateAndUnlock,
      accessCode
    );
  }

  private async buildLoginCredentials(
    requestId: string,
    response: AuthRequestResponse
  ): Promise<PasswordlessLogInCredentials> {
    const decKey = await this.cryptoService.rsaDecrypt(response.key, this.authRequestKeyPair[1]);
    const decMasterPasswordHash = await this.cryptoService.rsaDecrypt(
      response.masterPasswordHash,
      this.authRequestKeyPair[1]
    );
    const key = new SymmetricCryptoKey(decKey);
    const localHashedPassword = Utils.fromBufferToUtf8(decMasterPasswordHash);

    return new PasswordlessLogInCredentials(
      this.email,
      this.passwordlessRequest.accessCode,
      requestId,
      key,
      localHashedPassword
    );
  }
}
