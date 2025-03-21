import { CommonModule } from "@angular/common";
import { Component, OnDestroy, OnInit } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { IsActiveMatchOptions, Router, RouterModule } from "@angular/router";
import { firstValueFrom, map } from "rxjs";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  AuthRequestLoginCredentials,
  AuthRequestServiceAbstraction,
  LoginEmailServiceAbstraction,
  LoginStrategyServiceAbstraction,
  LoginSuccessHandlerService,
} from "@bitwarden/auth/common";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AnonymousHubService } from "@bitwarden/common/auth/abstractions/anonymous-hub.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthRequestType } from "@bitwarden/common/auth/enums/auth-request-type";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AdminAuthRequestStorable } from "@bitwarden/common/auth/models/domain/admin-auth-req-storable";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { LoginViaAuthRequestView } from "@bitwarden/common/auth/models/view/login-via-auth-request.view";
import { ClientType, HttpStatusCode } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ValidationService } from "@bitwarden/common/platform/abstractions/validation.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { UserId } from "@bitwarden/common/types/guid";
import { ButtonModule, LinkModule, ToastService } from "@bitwarden/components";
import { PasswordGenerationServiceAbstraction } from "@bitwarden/generator-legacy";

import { AuthRequestApiService } from "../../common/abstractions/auth-request-api.service";
import { LoginViaAuthRequestCacheService } from "../../common/services/auth-request/default-login-via-auth-request-cache.service";

enum Flow {
  StandardAuthRequest, // when user clicks "Login with device" from /login or "Approve from your other device" from /login-initiated
  AdminAuthRequest, // when user clicks "Request admin approval" from /login-initiated
}

const matchOptions: IsActiveMatchOptions = {
  paths: "exact",
  queryParams: "ignored",
  fragment: "ignored",
  matrixParams: "ignored",
};

@Component({
  standalone: true,
  templateUrl: "./login-via-auth-request.component.html",
  imports: [ButtonModule, CommonModule, JslibModule, LinkModule, RouterModule],
  providers: [{ provide: LoginViaAuthRequestCacheService }],
})
export class LoginViaAuthRequestComponent implements OnInit, OnDestroy {
  private authRequestKeyPair:
    | { publicKey: Uint8Array | undefined; privateKey: Uint8Array | undefined }
    | undefined = undefined;
  private accessCode: string | undefined = undefined;
  private authStatus: AuthenticationStatus | undefined = undefined;
  private showResendNotificationTimeoutSeconds = 12;

  protected backToRoute = "/login";
  protected clientType: ClientType;
  protected ClientType = ClientType;
  protected email: string | undefined = undefined;
  protected fingerprintPhrase: string | undefined = undefined;
  protected showResendNotification = false;
  protected Flow = Flow;
  protected flow = Flow.StandardAuthRequest;
  protected webVaultUrl: string | undefined = undefined;
  protected deviceManagementUrl: string | undefined;

  constructor(
    private accountService: AccountService,
    private anonymousHubService: AnonymousHubService,
    private appIdService: AppIdService,
    private authRequestApiService: AuthRequestApiService,
    private authRequestService: AuthRequestServiceAbstraction,
    private authService: AuthService,
    private cryptoFunctionService: CryptoFunctionService,
    private deviceTrustService: DeviceTrustServiceAbstraction,
    private environmentService: EnvironmentService,
    private i18nService: I18nService,
    private logService: LogService,
    private loginEmailService: LoginEmailServiceAbstraction,
    private loginStrategyService: LoginStrategyServiceAbstraction,
    private passwordGenerationService: PasswordGenerationServiceAbstraction,
    private platformUtilsService: PlatformUtilsService,
    private router: Router,
    private toastService: ToastService,
    private validationService: ValidationService,
    private loginSuccessHandlerService: LoginSuccessHandlerService,
    private loginViaAuthRequestCacheService: LoginViaAuthRequestCacheService,
    private configService: ConfigService,
  ) {
    this.clientType = this.platformUtilsService.getClientType();

    // Gets SignalR push notification
    // Only fires on approval to prevent enumeration
    this.authRequestService.authRequestPushNotification$
      .pipe(takeUntilDestroyed())
      .subscribe((requestId) => {
        this.processAuthRequestResponse(requestId).catch((e: Error) => {
          this.toastService.showToast({
            variant: "error",
            title: this.i18nService.t("error"),
            message: e.message,
          });

          this.logService.error("Failed to use approved auth request: " + e.message);
        });
      });

    // Get the web vault URL from the environment service
    this.environmentService.environment$.pipe(takeUntilDestroyed()).subscribe((env) => {
      this.webVaultUrl = env.getWebVaultUrl();
      this.deviceManagementUrl = `${this.webVaultUrl}/#/settings/security/device-management`;
    });
  }

  async ngOnInit(): Promise<void> {
    // Get the authStatus early because we use it in both flows
    this.authStatus = await firstValueFrom(this.authService.activeAccountStatus$);
    await this.loginViaAuthRequestCacheService.init();

    const userHasAuthenticatedViaSSO = this.authStatus === AuthenticationStatus.Locked;

    if (userHasAuthenticatedViaSSO) {
      this.backToRoute = "/login-initiated";
    }

    /**
     * The LoginViaAuthRequestComponent handles both the `login-with-device` and
     * the `admin-approval-requested` routes. Therefore, we check the route to determine
     * which flow to initialize.
     */
    if (this.router.isActive("admin-approval-requested", matchOptions)) {
      await this.initAdminAuthRequestFlow();
    } else {
      await this.initStandardAuthRequestFlow();
    }
  }

  private async initAdminAuthRequestFlow(): Promise<void> {
    this.flow = Flow.AdminAuthRequest;

    // Get email from state for admin auth requests because it is available and also
    // prevents it from being lost on refresh as the loginEmailService email does not persist.
    this.email = await firstValueFrom(
      this.accountService.activeAccount$.pipe(map((a) => a?.email)),
    );

    if (!this.email) {
      await this.handleMissingEmail();
      return;
    }

    // We only allow a single admin approval request to be active at a time
    // so we must check state to see if we have an existing one or not
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (!userId) {
      this.logService.error(
        "Not able to get a user id from the account service active account observable.",
      );
      return;
    }

    const existingAdminAuthRequest = await this.authRequestService.getAdminAuthRequest(userId);

    if (existingAdminAuthRequest) {
      await this.handleExistingAdminAuthRequest(existingAdminAuthRequest, userId);
    } else {
      await this.startAdminAuthRequestLogin();
    }
  }

  private async initStandardAuthRequestFlow(): Promise<void> {
    this.flow = Flow.StandardAuthRequest;

    this.email = (await firstValueFrom(this.loginEmailService.loginEmail$)) || undefined;

    if (!this.email) {
      await this.handleMissingEmail();
      return;
    }

    // [Standard Flow State Management] Check cached auth request
    const cachedAuthRequest: LoginViaAuthRequestView | null =
      this.loginViaAuthRequestCacheService.getCachedLoginViaAuthRequestView();

    if (cachedAuthRequest) {
      if (!cachedAuthRequest.id) {
        this.logService.error(
          "No id on the cached auth request when in the standard auth request flow.",
        );
        return;
      }

      await this.reloadCachedStandardAuthRequest(cachedAuthRequest);
      await this.processAuthRequestResponse(cachedAuthRequest.id);
    } else {
      await this.startStandardAuthRequestLogin();
    }
  }

  private async handleMissingEmail(): Promise<void> {
    this.toastService.showToast({
      variant: "error",
      message: this.i18nService.t("userEmailMissing"),
    });

    await this.router.navigate([this.backToRoute]);
  }

  async ngOnDestroy(): Promise<void> {
    await this.anonymousHubService.stopHubConnection();

    this.loginViaAuthRequestCacheService.clearCacheLoginView();
  }

  private async startAdminAuthRequestLogin(): Promise<void> {
    try {
      if (!this.email) {
        this.logService.error("No email when starting admin auth request login.");
        return;
      }

      // Scope this auth request to just this process. We don't want it to carry
      // on outside of this scope because it should either be regenerated with
      // what is in the cache or created initially like it is doing here.
      const authRequest = await this.buildAuthRequest(this.email, AuthRequestType.AdminApproval);

      if (!authRequest) {
        this.logService.error("Auth request failed to build.");
        return;
      }

      if (!this.authRequestKeyPair) {
        this.logService.error("Key pairs failed to initialize from buildAuthRequest.");
        return;
      }

      const authRequestResponse =
        await this.authRequestApiService.postAdminAuthRequest(authRequest);

      const adminAuthReqStorable = new AdminAuthRequestStorable({
        id: authRequestResponse.id,
        privateKey: this.authRequestKeyPair.privateKey,
      });

      const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;

      if (!userId) {
        this.logService.error(
          "Not able to get a user id from the account service active account observable.",
        );
        return;
      }

      await this.authRequestService.setAdminAuthRequest(adminAuthReqStorable, userId);

      if (authRequestResponse.id) {
        await this.anonymousHubService.createHubConnection(authRequestResponse.id);
      }
    } catch (e) {
      this.logService.error(e);
    }
  }

  /**
   * Loads the cached auth request into the component state.
   * @param cachedAuthRequest The request to load into the component state
   * @returns Promise to await for completion
   */
  protected async reloadCachedStandardAuthRequest(
    cachedAuthRequest: LoginViaAuthRequestView,
  ): Promise<void> {
    if (cachedAuthRequest) {
      // Grab the cached information and store it back in component state.
      // We don't need the public key for handling the authentication request because
      // the verifyAndHandleApprovedAuthReq function will receive the public key back
      // from the looked up auth request and all we need is to make sure that
      // we can use the cached private key that is associated with it.

      if (!this.email) {
        this.logService.error("Email not defined when handling an existing auth request.");
        return;
      }

      if (!cachedAuthRequest.privateKey) {
        this.logService.error("No private key on the cached auth request.");
        return;
      }

      const privateKey = Utils.fromB64ToArray(cachedAuthRequest.privateKey);

      // Re-derive the user's fingerprint phrase
      // It is important to not use the server's public key here as it could have been compromised via MITM
      const derivedPublicKeyArrayBuffer =
        await this.cryptoFunctionService.rsaExtractPublicKey(privateKey);

      this.fingerprintPhrase = await this.authRequestService.getFingerprintPhrase(
        this.email,
        derivedPublicKeyArrayBuffer,
      );

      // Request still pending response from admin set keypair and create hub connection
      // so that any approvals will be received via push notification
      this.authRequestKeyPair = {
        privateKey: privateKey,
        publicKey: undefined,
      };
    }
  }

  protected async startStandardAuthRequestLogin(): Promise<void> {
    this.showResendNotification = false;

    try {
      if (!this.email) {
        this.logService.error("Email not defined when starting standard auth request login.");
        return;
      }

      const authRequest = await this.buildAuthRequest(
        this.email,
        AuthRequestType.AuthenticateAndUnlock,
      );

      // I tried several ways to get the IDE/linter to play nice with checking for null values
      // in less code / more efficiently, but it struggles to identify code paths that
      // are more complicated than this.
      if (!authRequest) {
        this.logService.error("AuthRequest failed to initialize from buildAuthRequest.");
        return;
      }

      if (!this.fingerprintPhrase) {
        this.logService.error("FingerprintPhrase failed to initialize from buildAuthRequest.");
        return;
      }

      if (!this.authRequestKeyPair) {
        this.logService.error("KeyPair failed to initialize from buildAuthRequest.");
        return;
      }

      const authRequestResponse: AuthRequestResponse =
        await this.authRequestApiService.postAuthRequest(authRequest);

      if (await this.configService.getFeatureFlag(FeatureFlag.PM9112_DeviceApprovalPersistence)) {
        if (!this.authRequestKeyPair.privateKey) {
          this.logService.error("No private key when trying to cache the login view.");
          return;
        }

        if (!this.accessCode) {
          this.logService.error("No access code when trying to cache the login view.");
          return;
        }

        this.loginViaAuthRequestCacheService.cacheLoginView(
          authRequestResponse.id,
          this.authRequestKeyPair.privateKey,
          this.accessCode,
        );
      }

      if (authRequestResponse.id) {
        await this.anonymousHubService.createHubConnection(authRequestResponse.id);
      }
    } catch (e) {
      this.logService.error(e);
    }

    setTimeout(() => {
      this.showResendNotification = true;
    }, this.showResendNotificationTimeoutSeconds * 1000);
  }

  private async buildAuthRequest(
    email: string,
    authRequestType: AuthRequestType,
  ): Promise<AuthRequest> {
    const authRequestKeyPairArray = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);

    this.authRequestKeyPair = {
      publicKey: authRequestKeyPairArray[0],
      privateKey: authRequestKeyPairArray[1],
    };

    const deviceIdentifier = await this.appIdService.getAppId();

    if (!this.authRequestKeyPair.publicKey) {
      const errorMessage = "No public key when building an auth request.";
      this.logService.error(errorMessage);
      throw new Error(errorMessage);
    }

    this.fingerprintPhrase = await this.authRequestService.getFingerprintPhrase(
      email,
      this.authRequestKeyPair.publicKey,
    );

    this.accessCode = await this.passwordGenerationService.generatePassword({
      type: "password",
      length: 25,
    });

    const b64PublicKey = Utils.fromBufferToB64(this.authRequestKeyPair.publicKey);

    return new AuthRequest(email, deviceIdentifier, b64PublicKey, authRequestType, this.accessCode);
  }

  private async handleExistingAdminAuthRequest(
    adminAuthRequestStorable: AdminAuthRequestStorable,
    userId: UserId,
  ): Promise<void> {
    // Note: on login, the SSOLoginStrategy will also call to see if an existing admin auth req
    // has been approved and handle it if so.

    // Regardless, we always retrieve the auth request from the server and verify and handle status changes here as well
    let adminAuthRequestResponse: AuthRequestResponse;

    try {
      adminAuthRequestResponse = await this.authRequestApiService.getAuthRequest(
        adminAuthRequestStorable.id,
      );
    } catch (error) {
      if (error instanceof ErrorResponse && error.statusCode === HttpStatusCode.NotFound) {
        return await this.clearExistingAdminAuthRequestAndStartNewRequest(userId);
      }
      this.logService.error(error);
      return;
    }

    // Request doesn't exist anymore
    if (!adminAuthRequestResponse) {
      return await this.clearExistingAdminAuthRequestAndStartNewRequest(userId);
    }

    // Request denied
    if (adminAuthRequestResponse.isAnswered && !adminAuthRequestResponse.requestApproved) {
      return await this.clearExistingAdminAuthRequestAndStartNewRequest(userId);
    }

    // Request approved
    if (adminAuthRequestResponse.requestApproved) {
      return await this.decryptViaApprovedAuthRequest(
        adminAuthRequestResponse,
        adminAuthRequestStorable.privateKey,
        userId,
      );
    }

    if (!this.email) {
      this.logService.error("Email not defined when handling an existing an admin auth request.");
      return;
    }

    // Re-derive the user's fingerprint phrase
    // It is important to not use the server's public key here as it could have been compromised via MITM
    const derivedPublicKeyArrayBuffer = await this.cryptoFunctionService.rsaExtractPublicKey(
      adminAuthRequestStorable.privateKey,
    );

    this.fingerprintPhrase = await this.authRequestService.getFingerprintPhrase(
      this.email,
      derivedPublicKeyArrayBuffer,
    );

    // Request still pending response from admin set keypair and create hub connection
    // so that any approvals will be received via push notification
    this.authRequestKeyPair = {
      privateKey: adminAuthRequestStorable.privateKey,
      publicKey: undefined,
    };
    await this.anonymousHubService.createHubConnection(adminAuthRequestStorable.id);
  }

  /**
   * This is used for trying to get the auth request back out of state.
   * @param requestId
   * @private
   */
  private async retrieveAuthRequest(requestId: string): Promise<AuthRequestResponse> {
    let authRequestResponse: AuthRequestResponse | undefined = undefined;
    try {
      // There are two cases here, the first being
      const userHasAuthenticatedViaSSO = this.authStatus === AuthenticationStatus.Locked;

      // Get the response based on whether we've authenticated or not.  We need to call a different API method
      // based on whether we have a token or need to use the accessCode.
      if (userHasAuthenticatedViaSSO) {
        authRequestResponse = await this.authRequestApiService.getAuthRequest(requestId);
      } else {
        if (!this.accessCode) {
          const errorMessage = "No access code available when handling approved auth request.";
          this.logService.error(errorMessage);
          throw new Error(errorMessage);
        }
        authRequestResponse = await this.authRequestApiService.getAuthResponse(
          requestId,
          this.accessCode,
        );
      }
    } catch (error) {
      // If the request no longer exists, we treat it as if it's been answered (and denied).
      if (error instanceof ErrorResponse && error.statusCode === HttpStatusCode.NotFound) {
        this.logService.error(error.message);
        throw new Error(error.message);
      }
    }

    if (authRequestResponse === undefined) {
      throw new Error("Auth reqeust response not generated");
    }

    return authRequestResponse;
  }

  /**
   * Determines if the Auth Request has been approved, deleted or denied, and handles
   * the response accordingly.
   * @param requestId The ID of the Auth Request to process
   * @returns A boolean indicating whether the Auth Request was successfully processed
   */
  private async processAuthRequestResponse(requestId: string): Promise<void> {
    try {
      const authRequestResponse = await this.retrieveAuthRequest(requestId);

      // Request doesn't exist anymore, so we'll clear the cache and start a new request.
      if (!authRequestResponse) {
        return await this.clearExistingStandardAuthRequestAndStartNewRequest();
      }

      // Request denied, so we'll clear the cache and start a new request.
      if (authRequestResponse.isAnswered && !authRequestResponse.requestApproved) {
        return await this.clearExistingStandardAuthRequestAndStartNewRequest();
      }

      // Request approved, so we'll log the user in.
      if (authRequestResponse.requestApproved) {
        const userHasAuthenticatedViaSSO = this.authStatus === AuthenticationStatus.Locked;
        if (userHasAuthenticatedViaSSO) {
          // [Standard Flow 3-4] Handle authenticated SSO TD user flows
          return await this.handleAuthenticatedFlows(authRequestResponse);
        } else {
          // [Standard Flow 1-2] Handle unauthenticated user flows
          return await this.handleUnauthenticatedFlows(authRequestResponse, requestId);
        }
      }

      // At this point, we know that the request is still pending, so we'll start a hub connection to listen for a response.
      await this.anonymousHubService.createHubConnection(requestId);
    } catch (error) {
      if (error instanceof ErrorResponse) {
        await this.router.navigate([this.backToRoute]);
        this.validationService.showError(error);
      }
      this.logService.error(error);
    }
  }

  private async handleAuthenticatedFlows(authRequestResponse: AuthRequestResponse) {
    // [Standard Flow 3-4] Handle authenticated SSO TD user flows
    const userId = (await firstValueFrom(this.accountService.activeAccount$))?.id;
    if (!userId) {
      this.logService.error(
        "Not able to get a user id from the account service active account observable.",
      );
      return;
    }

    if (!this.authRequestKeyPair || !this.authRequestKeyPair.privateKey) {
      this.logService.error("No private key set when handling the authenticated flows.");
      return;
    }

    await this.decryptViaApprovedAuthRequest(
      authRequestResponse,
      this.authRequestKeyPair.privateKey,
      userId,
    );
  }

  private async handleUnauthenticatedFlows(
    authRequestResponse: AuthRequestResponse,
    requestId: string,
  ) {
    // [Standard Flow 1-2] Handle unauthenticated user flows
    const authRequestLoginCredentials = await this.buildAuthRequestLoginCredentials(
      requestId,
      authRequestResponse,
    );

    if (!authRequestLoginCredentials) {
      this.logService.error("Didn't set up auth request login credentials properly.");
      return;
    }

    // Note: keys are set by AuthRequestLoginStrategy success handling
    const authResult = await this.loginStrategyService.logIn(authRequestLoginCredentials);

    await this.handlePostLoginNavigation(authResult);
  }

  private async decryptViaApprovedAuthRequest(
    authRequestResponse: AuthRequestResponse,
    privateKey: ArrayBuffer,
    userId: UserId,
  ): Promise<void> {
    /**
     * [Flow Type Detection]
     * We determine the type of `key` based on the presence or absence of `masterPasswordHash`:
     *  - If `masterPasswordHash` exists: Standard Flow 1 or 3 (device has masterKey)
     *  - If no `masterPasswordHash`: Standard Flow 2, 4, or Admin Flow (device sends userKey)
     */
    if (authRequestResponse.masterPasswordHash) {
      // [Standard Flow 1 or 3] Device has masterKey
      await this.authRequestService.setKeysAfterDecryptingSharedMasterKeyAndHash(
        authRequestResponse,
        privateKey,
        userId,
      );
    } else {
      // [Standard Flow 2, 4, or Admin Flow] Device sends userKey
      await this.authRequestService.setUserKeyAfterDecryptingSharedUserKey(
        authRequestResponse,
        privateKey,
        userId,
      );
    }

    // [Admin Flow Cleanup] Clear one-time use admin auth request
    // clear the admin auth request from state so it cannot be used again (it's a one time use)
    // TODO: this should eventually be enforced via deleting this on the server once it is used
    await this.authRequestService.clearAdminAuthRequest(userId);

    this.toastService.showToast({
      variant: "success",
      message: this.i18nService.t("loginApproved"),
    });

    // [Device Trust] Establish trust if required
    // Now that we have a decrypted user key in memory, we can check if we
    // need to establish trust on the current device
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
    if (!activeAccount) {
      this.logService.error("No active account defined from the account service.");
      return;
    }

    await this.deviceTrustService.trustDeviceIfRequired(activeAccount.id);

    await this.handleSuccessfulLoginNavigation(userId);
  }

  /**
   * Takes an `AuthRequestResponse` and decrypts the `key` to build an `AuthRequestLoginCredentials`
   * object for use in the `AuthRequestLoginStrategy`.
   *
   * The credentials object that gets built is affected by whether the `authRequestResponse.key`
   * is an encrypted MasterKey or an encrypted UserKey.
   */
  private async buildAuthRequestLoginCredentials(
    requestId: string,
    authRequestResponse: AuthRequestResponse,
  ): Promise<AuthRequestLoginCredentials | undefined> {
    if (!this.authRequestKeyPair || !this.authRequestKeyPair.privateKey) {
      this.logService.error("No private key set when building auth request login credentials.");
      return;
    }

    if (!this.email) {
      this.logService.error("Email not defined.");
      return;
    }

    if (!this.accessCode) {
      this.logService.error(
        "Access code not defined when building auth request login credentials.",
      );
      return;
    }

    /**
     * See verifyAndHandleApprovedAuthReq() for flow details.
     *
     * We determine the type of `key` based on the presence or absence of `masterPasswordHash`:
     *  - If `masterPasswordHash` has a value, we receive the `key` as an authRequestPublicKey(masterKey) [plus we have authRequestPublicKey(masterPasswordHash)]
     *  - If `masterPasswordHash` does not have a value, we receive the `key` as an authRequestPublicKey(userKey)
     */
    if (authRequestResponse.masterPasswordHash) {
      // ...in Standard Auth Request Flow 1
      const { masterKey, masterKeyHash } =
        await this.authRequestService.decryptPubKeyEncryptedMasterKeyAndHash(
          authRequestResponse.key,
          authRequestResponse.masterPasswordHash,
          this.authRequestKeyPair.privateKey,
        );

      return new AuthRequestLoginCredentials(
        this.email,
        this.accessCode,
        requestId,
        null, // no userKey
        masterKey,
        masterKeyHash,
      );
    } else {
      // ...in Standard Auth Request Flow 2
      const userKey = await this.authRequestService.decryptPubKeyEncryptedUserKey(
        authRequestResponse.key,
        this.authRequestKeyPair.privateKey,
      );
      return new AuthRequestLoginCredentials(
        this.email,
        this.accessCode,
        requestId,
        userKey,
        null, // no masterKey
        null, // no masterKeyHash
      );
    }
  }

  private async clearExistingAdminAuthRequestAndStartNewRequest(userId: UserId) {
    // clear the admin auth request from state
    await this.authRequestService.clearAdminAuthRequest(userId);

    // start new auth request
    await this.startAdminAuthRequestLogin();
  }

  private async clearExistingStandardAuthRequestAndStartNewRequest(): Promise<void> {
    // clear the auth request from state
    this.loginViaAuthRequestCacheService.clearCacheLoginView();

    // start new auth request
    await this.startStandardAuthRequestLogin();
  }

  private async handlePostLoginNavigation(loginResponse: AuthResult) {
    if (loginResponse.requiresTwoFactor) {
      await this.router.navigate(["2fa"]);
    } else if (loginResponse.forcePasswordReset != ForceSetPasswordReason.None) {
      await this.router.navigate(["update-temp-password"]);
    } else {
      await this.handleSuccessfulLoginNavigation(loginResponse.userId);
    }
  }

  private async handleSuccessfulLoginNavigation(userId: UserId) {
    if (this.flow === Flow.StandardAuthRequest) {
      // Only need to set remembered email on standard login with auth req flow
      await this.loginEmailService.saveEmailSettings();
    }

    await this.loginSuccessHandlerService.run(userId);
    await this.router.navigate(["vault"]);
  }
}
