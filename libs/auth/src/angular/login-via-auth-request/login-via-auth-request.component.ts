// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
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
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { AuthRequestType } from "@bitwarden/common/auth/enums/auth-request-type";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { AdminAuthRequestStorable } from "@bitwarden/common/auth/models/domain/admin-auth-req-storable";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { ForceSetPasswordReason } from "@bitwarden/common/auth/models/domain/force-set-password-reason";
import { AuthRequest } from "@bitwarden/common/auth/models/request/auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { ClientType, HttpStatusCode } from "@bitwarden/common/enums";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
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
})
export class LoginViaAuthRequestComponent implements OnInit, OnDestroy {
  private authRequest: AuthRequest;
  private authRequestKeyPair: { publicKey: Uint8Array; privateKey: Uint8Array };
  private authStatus: AuthenticationStatus;
  private showResendNotificationTimeoutSeconds = 12;

  protected backToRoute = "/login";
  protected clientType: ClientType;
  protected ClientType = ClientType;
  protected email: string;
  protected fingerprintPhrase: string;
  protected showResendNotification = false;
  protected Flow = Flow;
  protected flow = Flow.StandardAuthRequest;
  protected webVaultUrl: string;
  protected deviceManagementUrl: string;

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
  ) {
    this.clientType = this.platformUtilsService.getClientType();

    // Gets SignalR push notification
    // Only fires on approval to prevent enumeration
    this.authRequestService.authRequestPushNotification$
      .pipe(takeUntilDestroyed())
      .subscribe((requestId) => {
        this.verifyAndHandleApprovedAuthReq(requestId).catch((e: Error) => {
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

    const userHasAuthenticatedViaSSO = this.authStatus === AuthenticationStatus.Locked;

    if (userHasAuthenticatedViaSSO) {
      this.backToRoute = "/login-initiated";
    }

    /**
     * The LoginViaAuthRequestComponent handles both the `login-with-device` and
     * the `admin-approval-requested` routes. Therefore we check the route to determine
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
    const userId = (await firstValueFrom(this.accountService.activeAccount$)).id;
    const existingAdminAuthRequest = await this.authRequestService.getAdminAuthRequest(userId);

    if (existingAdminAuthRequest) {
      await this.handleExistingAdminAuthRequest(existingAdminAuthRequest, userId);
    } else {
      await this.startAdminAuthRequestLogin();
    }
  }

  private async initStandardAuthRequestFlow(): Promise<void> {
    this.flow = Flow.StandardAuthRequest;

    this.email = await firstValueFrom(this.loginEmailService.loginEmail$);

    if (!this.email) {
      await this.handleMissingEmail();
      return;
    }

    await this.startStandardAuthRequestLogin();
  }

  private async handleMissingEmail(): Promise<void> {
    this.toastService.showToast({
      variant: "error",
      title: null,
      message: this.i18nService.t("userEmailMissing"),
    });

    await this.router.navigate([this.backToRoute]);
  }

  async ngOnDestroy(): Promise<void> {
    await this.anonymousHubService.stopHubConnection();
  }

  private async startAdminAuthRequestLogin(): Promise<void> {
    try {
      await this.buildAuthRequest(AuthRequestType.AdminApproval);

      const authRequestResponse = await this.authRequestApiService.postAdminAuthRequest(
        this.authRequest,
      );
      const adminAuthReqStorable = new AdminAuthRequestStorable({
        id: authRequestResponse.id,
        privateKey: this.authRequestKeyPair.privateKey,
      });

      const userId = (await firstValueFrom(this.accountService.activeAccount$)).id;
      await this.authRequestService.setAdminAuthRequest(adminAuthReqStorable, userId);

      if (authRequestResponse.id) {
        await this.anonymousHubService.createHubConnection(authRequestResponse.id);
      }
    } catch (e) {
      this.logService.error(e);
    }
  }

  protected async startStandardAuthRequestLogin(): Promise<void> {
    this.showResendNotification = false;

    try {
      await this.buildAuthRequest(AuthRequestType.AuthenticateAndUnlock);

      const authRequestResponse = await this.authRequestApiService.postAuthRequest(
        this.authRequest,
      );

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

  private async buildAuthRequest(authRequestType: AuthRequestType): Promise<void> {
    const authRequestKeyPairArray = await this.cryptoFunctionService.rsaGenerateKeyPair(2048);

    this.authRequestKeyPair = {
      publicKey: authRequestKeyPairArray[0],
      privateKey: authRequestKeyPairArray[1],
    };

    const deviceIdentifier = await this.appIdService.getAppId();
    const publicKey = Utils.fromBufferToB64(this.authRequestKeyPair.publicKey);
    const accessCode = await this.passwordGenerationService.generatePassword({
      type: "password",
      length: 25,
    });

    this.fingerprintPhrase = await this.authRequestService.getFingerprintPhrase(
      this.email,
      this.authRequestKeyPair.publicKey,
    );

    this.authRequest = new AuthRequest(
      this.email,
      deviceIdentifier,
      publicKey,
      authRequestType,
      accessCode,
    );
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
        return await this.handleExistingAdminAuthReqDeletedOrDenied(userId);
      }
    }

    // Request doesn't exist anymore
    if (!adminAuthRequestResponse) {
      return await this.handleExistingAdminAuthReqDeletedOrDenied(userId);
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

    // Request denied
    if (adminAuthRequestResponse.isAnswered && !adminAuthRequestResponse.requestApproved) {
      return await this.handleExistingAdminAuthReqDeletedOrDenied(userId);
    }

    // Request approved
    if (adminAuthRequestResponse.requestApproved) {
      return await this.decryptViaApprovedAuthRequest(
        adminAuthRequestResponse,
        adminAuthRequestStorable.privateKey,
        userId,
      );
    }

    // Request still pending response from admin
    // set keypair and create hub connection so that any approvals will be received via push notification
    this.authRequestKeyPair = { privateKey: adminAuthRequestStorable.privateKey, publicKey: null };
    await this.anonymousHubService.createHubConnection(adminAuthRequestStorable.id);
  }

  private async verifyAndHandleApprovedAuthReq(requestId: string): Promise<void> {
    /**
     * ***********************************
     *     Standard Auth Request Flows
     * ***********************************
     *
     * Flow 1: Unauthed user requests approval from device; Approving device has a masterKey in memory.
     *
     *         Unauthed user clicks "Login with device" > navigates to /login-with-device which creates a StandardAuthRequest
     *           > receives approval from a device with authRequestPublicKey(masterKey) > decrypts masterKey > decrypts userKey > proceed to vault
     *
     * Flow 2: Unauthed user requests approval from device; Approving device does NOT have a masterKey in memory.
     *
     *         Unauthed user clicks "Login with device" > navigates to /login-with-device which creates a StandardAuthRequest
     *           > receives approval from a device with authRequestPublicKey(userKey) > decrypts userKey > proceeds to vault
     *
     *         Note: this flow is an uncommon scenario and relates to TDE off-boarding. The following describes how a user could get into this flow:
     *           1) An SSO TD user logs into a device via an Admin auth request approval, therefore this device does NOT have a masterKey in memory.
     *           2) The org admin...
     *              (2a) Changes the member decryption options from "Trusted devices" to "Master password" AND
     *              (2b) Turns off the "Require single sign-on authentication" policy
     *           3) On another device, the user clicks "Login with device", which they can do because the org no longer requires SSO.
     *           4) The user approves from the device they had previously logged into with SSO TD, which does NOT have a masterKey in memory (see step 1 above).
     *
     * Flow 3: Authed SSO TD user requests approval from device; Approving device has a masterKey in memory.
     *
     *         SSO TD user authenticates via SSO > navigates to /login-initiated > clicks "Approve from your other device"
     *           > navigates to /login-with-device which creates a StandardAuthRequest > receives approval from device with authRequestPublicKey(masterKey)
     *             > decrypts masterKey > decrypts userKey > establishes trust (if required) > proceeds to vault
     *
     * Flow 4: Authed SSO TD user requests approval from device; Approving device does NOT have a masterKey in memory.
     *
     *         SSO TD user authenticates via SSO > navigates to /login-initiated > clicks "Approve from your other device"
     *           > navigates to /login-with-device which creates a StandardAuthRequest > receives approval from device with authRequestPublicKey(userKey)
     *             > decrypts userKey > establishes trust (if required) > proceeds to vault
     *
     * ***********************************
     *     Admin Auth Request Flow
     * ***********************************
     *
     * Flow: Authed SSO TD user requests admin approval.
     *
     *         SSO TD user authenticates via SSO > navigates to /login-initiated > clicks "Request admin approval"
     *           > navigates to /admin-approval-requested which creates an AdminAuthRequest > receives approval from device with authRequestPublicKey(userKey)
     *             > decrypts userKey > establishes trust (if required) > proceeds to vault
     *
     *        Note: TDE users are required to be enrolled in admin password reset, which gives the admin access to the user's userKey.
     *              This is how admins are able to send over the authRequestPublicKey(userKey) to the user to allow them to unlock.
     *
     *
     *   Summary Table
     * |-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
     * |      Flow       | Auth Status |           Clicks Button [active route]              |       Navigates to        | Approving device has masterKey in memory (see note 1) |
     * |-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
     * | Standard Flow 1 | unauthed    | "Login with device"              [/login]           | /login-with-device        | yes                                                   |
     * | Standard Flow 2 | unauthed    | "Login with device"              [/login]           | /login-with-device        | no                                                    |
     * | Standard Flow 3 | authed      | "Approve from your other device" [/login-initiated] | /login-with-device        | yes                                                   |
     * | Standard Flow 4 | authed      | "Approve from your other device" [/login-initiated] | /login-with-device        | no                                                    |                                                |
     * | Admin Flow      | authed      | "Request admin approval"         [/login-initiated] | /admin-approval-requested | NA - admin requests always send encrypted userKey     |
     * |-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
     *    * Note 1: The phrase "in memory" here is important. It is possible for a user to have a master password for their account, but not have a masterKey IN MEMORY for
     *              a specific device. For example, if a user registers an account with a master password, then joins an SSO TD org, then logs in to a device via SSO and
     *              admin auth request, they are now logged into that device but that device does not have masterKey IN MEMORY.
     */

    try {
      const userHasAuthenticatedViaSSO = this.authStatus === AuthenticationStatus.Locked;

      if (userHasAuthenticatedViaSSO) {
        // Get the auth request from the server
        // User is authenticated, therefore the endpoint does not require an access code.
        const authRequestResponse = await this.authRequestApiService.getAuthRequest(requestId);

        if (authRequestResponse.requestApproved) {
          // Handles Standard Flows 3-4 and Admin Flow
          await this.handleAuthenticatedFlows(authRequestResponse);
        }
      } else {
        // Get the auth request from the server
        // User is unauthenticated, therefore the endpoint requires an access code for user verification.
        const authRequestResponse = await this.authRequestApiService.getAuthResponse(
          requestId,
          this.authRequest.accessCode,
        );

        if (authRequestResponse.requestApproved) {
          // Handles Standard Flows 1-2
          await this.handleUnauthenticatedFlows(authRequestResponse, requestId);
        }
      }
    } catch (error) {
      if (error instanceof ErrorResponse) {
        await this.router.navigate([this.backToRoute]);
        this.validationService.showError(error);
        return;
      }

      this.logService.error(error);
    }
  }

  private async handleAuthenticatedFlows(authRequestResponse: AuthRequestResponse) {
    const userId = (await firstValueFrom(this.accountService.activeAccount$)).id;

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
    const authRequestLoginCredentials = await this.buildAuthRequestLoginCredentials(
      requestId,
      authRequestResponse,
    );

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
     * See verifyAndHandleApprovedAuthReq() for flow details.
     *
     * We determine the type of `key` based on the presence or absence of `masterPasswordHash`:
     *  - If `masterPasswordHash` has a value, we receive the `key` as an authRequestPublicKey(masterKey) [plus we have authRequestPublicKey(masterPasswordHash)]
     *  - If `masterPasswordHash` does not have a value, we receive the `key` as an authRequestPublicKey(userKey)
     */

    if (authRequestResponse.masterPasswordHash) {
      // ...in Standard Auth Request Flow 3
      await this.authRequestService.setKeysAfterDecryptingSharedMasterKeyAndHash(
        authRequestResponse,
        privateKey,
        userId,
      );
    } else {
      // ...in Standard Auth Request Flow 4 or Admin Auth Request Flow
      await this.authRequestService.setUserKeyAfterDecryptingSharedUserKey(
        authRequestResponse,
        privateKey,
        userId,
      );
    }

    // clear the admin auth request from state so it cannot be used again (it's a one time use)
    // TODO: this should eventually be enforced via deleting this on the server once it is used
    await this.authRequestService.clearAdminAuthRequest(userId);

    this.toastService.showToast({
      variant: "success",
      title: null,
      message: this.i18nService.t("loginApproved"),
    });

    // Now that we have a decrypted user key in memory, we can check if we
    // need to establish trust on the current device
    const activeAccount = await firstValueFrom(this.accountService.activeAccount$);
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
  ): Promise<AuthRequestLoginCredentials> {
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
        this.authRequest.accessCode,
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
        this.authRequest.accessCode,
        requestId,
        userKey,
        null, // no masterKey
        null, // no masterKeyHash
      );
    }
  }

  private async handleExistingAdminAuthReqDeletedOrDenied(userId: UserId) {
    // clear the admin auth request from state
    await this.authRequestService.clearAdminAuthRequest(userId);

    // start new auth request
    await this.startAdminAuthRequestLogin();
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
