import { Directive, OnDestroy, OnInit } from "@angular/core";
import { IsActiveMatchOptions, Router } from "@angular/router";
import { Subject, takeUntil } from "rxjs";

import { AnonymousHubService } from "@bitwarden/common/abstractions/anonymousHub.service";
import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AuthRequestCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/auth-request-crypto.service.abstraction";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { LoginService } from "@bitwarden/common/auth/abstractions/login.service";
import { AuthRequestType } from "@bitwarden/common/auth/enums/auth-request-type";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AdminAuthRequestStorable } from "@bitwarden/common/auth/models/domain/admin-auth-req-storable";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
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
import { PasswordGenerationServiceAbstraction } from "@bitwarden/common/tools/generator/password";

import { CaptchaProtectedComponent } from "./captcha-protected.component";

// TODO: consider renaming this component something like LoginViaAuthRequest

enum State {
  StandardAuthRequest,
  AdminAuthRequest,
}

@Directive()
export class LoginWithDeviceComponent
  extends CaptchaProtectedComponent
  implements OnInit, OnDestroy
{
  private destroy$ = new Subject<void>();
  userAuthNStatus: AuthenticationStatus;
  email: string;
  showResendNotification = false;
  passwordlessRequest: PasswordlessCreateAuthRequest;
  fingerprintPhrase: string;
  onSuccessfulLoginTwoFactorNavigate: () => Promise<any>;
  onSuccessfulLogin: () => Promise<any>;
  onSuccessfulLoginNavigate: () => Promise<any>;
  onSuccessfulLoginForceResetNavigate: () => Promise<any>;

  protected adminApprovalRoute = "admin-approval-requested";

  protected State = State;
  protected state = State.StandardAuthRequest;

  protected twoFactorRoute = "2fa";
  protected successRoute = "vault";
  protected forcePasswordResetRoute = "update-temp-password";
  private resendTimeout = 12000;

  private authRequestKeyPair: { publicKey: ArrayBuffer; privateKey: ArrayBuffer };

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
    private loginService: LoginService,
    private deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    private authReqCryptoService: AuthRequestCryptoServiceAbstraction
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
        // Only fires on approval currently
        this.verifyAndHandleApprovedAuthReq(id);
      });
  }

  async ngOnInit() {
    this.userAuthNStatus = await this.authService.getAuthStatus();

    // TODO: refreshing this page takes you to the lock component
    // as email is lost on refresh; is that important to change for the admin approval flow?
    if (!this.email) {
      this.router.navigate(["/login"]);
      return;
    }

    const matchOptions: IsActiveMatchOptions = {
      paths: "exact",
      queryParams: "ignored",
      fragment: "ignored",
      matrixParams: "ignored",
    };

    if (this.router.isActive(this.adminApprovalRoute, matchOptions)) {
      this.state = State.AdminAuthRequest;

      // We only allow a single admin approval request to be active at a time
      // so must check state to see if we have an existing one or not
      const adminAuthReqStorable = await this.stateService.getAdminAuthRequest();

      if (adminAuthReqStorable) {
        await this.handleExistingAdminAuthRequest(adminAuthReqStorable);
      } else {
        // No existing admin auth request; so we need to create one
        this.startPasswordlessLogin();
      }
    } else {
      this.startPasswordlessLogin();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.anonymousHubService.stopHubConnection();
  }

  private async handleExistingAdminAuthRequest(adminAuthReqStorable: AdminAuthRequestStorable) {
    const adminAuthReqResponse = await this.apiService.getAuthRequest(adminAuthReqStorable.id);

    // Request doesn't exist
    if (!adminAuthReqResponse) {
      return await this.handleExistingAdminAuthReqDeletedOrDenied();
    }

    // Request denied
    if (adminAuthReqResponse.isAnswered && !adminAuthReqResponse.requestApproved) {
      return await this.handleExistingAdminAuthReqDeletedOrDenied();
    }

    // Request approved
    // if (adminAuthReqResponse.requestApproved) {
    // TODO: add logic for proceeding from here
    // }

    // Create hub connection if we have an existing admin auth request
    // so that any approvals will be received while on this component
    this.anonymousHubService.createHubConnection(adminAuthReqStorable.id);
  }

  private async handleExistingAdminAuthReqDeletedOrDenied() {
    // clear the admin auth request from state
    this.stateService.setAdminAuthRequest(null);

    // start new auth request
    this.startPasswordlessLogin();
  }

  private async buildAuthRequest(authRequestType: AuthRequestType) {
    const authRequestKeyPairArray = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);

    this.authRequestKeyPair = {
      publicKey: authRequestKeyPairArray[0],
      privateKey: authRequestKeyPairArray[1],
    };

    const deviceIdentifier = await this.appIdService.getAppId();
    const publicKey = Utils.fromBufferToB64(this.authRequestKeyPair.publicKey);
    const accessCode = await this.passwordGenerationService.generatePassword({ length: 25 });

    // TODO: figure out if fingerprint phrase needs to be shown for admin auth reqs
    // on second+ navigations to the page; yes it does.
    this.fingerprintPhrase = (
      await this.cryptoService.getFingerprint(this.email, this.authRequestKeyPair.publicKey)
    ).join("-");

    this.passwordlessRequest = new PasswordlessCreateAuthRequest(
      this.email,
      deviceIdentifier,
      publicKey,
      authRequestType,
      accessCode
    );
  }

  async startPasswordlessLogin() {
    this.showResendNotification = false;

    try {
      let reqResponse: AuthRequestResponse;

      if (this.state === State.AdminAuthRequest) {
        await this.buildAuthRequest(AuthRequestType.AdminApproval);
        reqResponse = await this.apiService.postAdminAuthRequest(this.passwordlessRequest);

        const adminAuthReqStorable = new AdminAuthRequestStorable({
          id: reqResponse.id,
          privateKey: this.authRequestKeyPair.privateKey,
        });

        await this.stateService.setAdminAuthRequest(adminAuthReqStorable);
      } else {
        await this.buildAuthRequest(AuthRequestType.AuthenticateAndUnlock);
        reqResponse = await this.apiService.postAuthRequest(this.passwordlessRequest);
      }

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

  private async verifyAndHandleApprovedAuthReq(requestId: string) {
    try {
      // Retrieve the auth request from server and verify it's approved
      let authReqResponse: AuthRequestResponse;

      switch (this.state) {
        case State.StandardAuthRequest:
          // Unauthed - access code required for user verification
          authReqResponse = await this.apiService.getAuthResponse(
            requestId,
            this.passwordlessRequest.accessCode
          );
          break;

        case State.AdminAuthRequest:
          // Authed - no access code required
          authReqResponse = await this.apiService.getAuthRequest(requestId);
          break;

        default:
          break;
      }

      if (!authReqResponse.requestApproved) {
        return;
      }

      // Approved so proceed:

      // 4 Scenarios to handle for approved auth requests:
      // Existing flow 1:
      //  - Anon Login with Device > User is not AuthN > receives approval from device with pubKey(masterKey)
      //    > decrypt masterKey > must authenticate > gets masterKey(userKey) > decrypt userKey and proceed to vault

      // 3 new flows from TDE:
      // Flow 2:
      //  - Post SSO > User is AuthN > SSO login strategy success sets masterKey(userKey) > receives approval from device with pubKey(masterKey)
      //    > decrypt masterKey > decrypt userKey > establish trust if required > proceed to vault
      // Flow 3:
      //  - Post SSO > User is AuthN > Receives approval from device with pubKey(userKey) > decrypt userKey > establish trust if required > proceed to vault
      // Flow 4:
      //  - Anon Login with Device > User is not AuthN > receives approval from device with pubKey(userKey)
      //    > decrypt userKey > must authenticate > set userKey > proceed to vault

      // if user has authenticated via SSO
      if (this.userAuthNStatus === AuthenticationStatus.Locked) {
        // Then it's flow 2 or 3 based on presence of masterPasswordHash
        if (authReqResponse.masterPasswordHash) {
          // Flow 2: masterPasswordHash is not null
          await this.authReqCryptoService.setKeysAfterDecryptingSharedMasterKeyAndHash(
            authReqResponse,
            this.authRequestKeyPair.privateKey
          );
        } else {
          // Flow 3: masterPasswordHash is null
          // then we can assume key is authRequestPublicKey(userKey) and we can just decrypt with userKey and proceed to vault
          await this.authReqCryptoService.setUserKeyAfterDecryptingSharedUserKey(
            authReqResponse,
            this.authRequestKeyPair.privateKey
          );
        }

        // Now that we have a decrypted user key in memory, we can check if we
        // need to establish trust on the current device
        await this.deviceTrustCryptoService.trustDeviceIfRequired();

        return await this.handleSuccessfulLoginNavigation();
      }

      // Flow 1 and 4:
      const loginAuthResult = await this.loginViaPasswordlessStrategy(requestId, authReqResponse);
      await this.handlePostLoginNavigation(loginAuthResult);
    } catch (error) {
      if (error instanceof ErrorResponse) {
        let errorRoute = "/login";
        if (this.state === State.AdminAuthRequest) {
          errorRoute = "/login-initiated";
        }

        this.router.navigate([errorRoute]);
        this.validationService.showError(error);
        return;
      }

      this.logService.error(error);
    }
  }

  // Authentication helper
  private async buildPasswordlessLoginCredentials(
    requestId: string,
    response: AuthRequestResponse
  ): Promise<PasswordlessLogInCredentials> {
    // if masterPasswordHash has a value, we will always receive key as authRequestPublicKey(masterKey) + authRequestPublicKey(masterPasswordHash)
    // if masterPasswordHash is null, we will always receive key as authRequestPublicKey(userKey)
    if (response.masterPasswordHash) {
      const { masterKey, masterKeyHash } =
        await this.authReqCryptoService.decryptAuthReqPubKeyEncryptedMasterKeyAndHash(
          response.key,
          response.masterPasswordHash,
          this.authRequestKeyPair.privateKey
        );

      return new PasswordlessLogInCredentials(
        this.email,
        this.passwordlessRequest.accessCode,
        requestId,
        null, // no userKey
        masterKey,
        masterKeyHash
      );
    } else {
      const userKey = await this.authReqCryptoService.decryptAuthReqPubKeyEncryptedUserKey(
        response.key,
        this.authRequestKeyPair.privateKey
      );
      return new PasswordlessLogInCredentials(
        this.email,
        this.passwordlessRequest.accessCode,
        requestId,
        userKey,
        null, // no masterKey
        null // no masterKeyHash
      );
    }
  }

  private async loginViaPasswordlessStrategy(
    requestId: string,
    authReqResponse: AuthRequestResponse
  ): Promise<AuthResult> {
    // Note: credentials change based on if the authReqResponse.key is a encryptedMasterKey or UserKey
    const credentials = await this.buildPasswordlessLoginCredentials(requestId, authReqResponse);

    // Note: keys are set by PasswordlessLogInStrategy success handling
    return await this.authService.logIn(credentials);
  }

  // Routing logic
  private async handlePostLoginNavigation(loginResponse: AuthResult) {
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
      await this.handleSuccessfulLoginNavigation();
    }
  }

  async setRememberEmailValues() {
    // TODO: solve bug with getRememberEmail not persisting across SSO to here
    const rememberEmail = this.loginService.getRememberEmail();
    const rememberedEmail = this.loginService.getEmail(); // this does persist across SSO
    await this.stateService.setRememberedEmail(rememberEmail ? rememberedEmail : null);
    this.loginService.clearValues();
  }

  private async handleSuccessfulLoginNavigation() {
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
}
