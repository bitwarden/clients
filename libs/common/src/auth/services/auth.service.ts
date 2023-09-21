import { Observable, Subject } from "rxjs";

import { ApiService } from "../../abstractions/api.service";
import { PolicyService } from "../../admin-console/abstractions/policy/policy.service.abstraction";
import { KdfType, KeySuffixOptions } from "../../enums";
import { PreloginRequest } from "../../models/request/prelogin.request";
import { ErrorResponse } from "../../models/response/error.response";
import { AuthRequestPushNotification } from "../../models/response/notification.response";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { EncryptService } from "../../platform/abstractions/encrypt.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { I18nService } from "../../platform/abstractions/i18n.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { MasterKey } from "../../platform/models/domain/symmetric-crypto-key";
import { PasswordStrengthServiceAbstraction } from "../../tools/password-strength";
import { AuthRequestCryptoServiceAbstraction } from "../abstractions/auth-request-crypto.service.abstraction";
import { AuthService as AuthServiceAbstraction } from "../abstractions/auth.service";
import { DeviceTrustCryptoServiceAbstraction } from "../abstractions/device-trust-crypto.service.abstraction";
import { KeyConnectorService } from "../abstractions/key-connector.service";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/two-factor.service";
import { AuthenticationStatus } from "../enums/authentication-status";
import { AuthenticationType } from "../enums/authentication-type";
import { PasswordLogInStrategy } from "../login-strategies/password-login.strategy";
import { PasswordlessLogInStrategy } from "../login-strategies/passwordless-login.strategy";
import { SsoLogInStrategy } from "../login-strategies/sso-login.strategy";
import { UserApiLogInStrategy } from "../login-strategies/user-api-login.strategy";
import { AuthResult } from "../models/domain/auth-result";
import { KdfConfig } from "../models/domain/kdf-config";
import {
  PasswordlessLogInCredentials,
  PasswordLogInCredentials,
  SsoLogInCredentials,
  UserApiLogInCredentials,
} from "../models/domain/log-in-credentials";
import { TokenTwoFactorRequest } from "../models/request/identity-token/token-two-factor.request";
import { PasswordlessAuthRequest } from "../models/request/passwordless-auth.request";
import { AuthRequestResponse } from "../models/response/auth-request.response";

const sessionTimeoutLength = 2 * 60 * 1000; // 2 minutes

export class AuthService implements AuthServiceAbstraction {
  get email(): string {
    if (
      this.logInStrategy instanceof PasswordLogInStrategy ||
      this.logInStrategy instanceof PasswordlessLogInStrategy ||
      this.logInStrategy instanceof SsoLogInStrategy
    ) {
      return this.logInStrategy.email;
    }

    return null;
  }

  get masterPasswordHash(): string {
    return this.logInStrategy instanceof PasswordLogInStrategy
      ? this.logInStrategy.masterPasswordHash
      : null;
  }

  get accessCode(): string {
    return this.logInStrategy instanceof PasswordlessLogInStrategy
      ? this.logInStrategy.accessCode
      : null;
  }

  get authRequestId(): string {
    return this.logInStrategy instanceof PasswordlessLogInStrategy
      ? this.logInStrategy.authRequestId
      : null;
  }

  get ssoEmail2FaSessionToken(): string {
    return this.logInStrategy instanceof SsoLogInStrategy
      ? this.logInStrategy.ssoEmail2FaSessionToken
      : null;
  }

  private logInStrategy:
    | UserApiLogInStrategy
    | PasswordLogInStrategy
    | SsoLogInStrategy
    | PasswordlessLogInStrategy;
  private sessionTimeout: any;

  private pushNotificationSubject = new Subject<string>();

  constructor(
    protected cryptoService: CryptoService,
    protected apiService: ApiService,
    protected tokenService: TokenService,
    protected appIdService: AppIdService,
    protected platformUtilsService: PlatformUtilsService,
    protected messagingService: MessagingService,
    protected logService: LogService,
    protected keyConnectorService: KeyConnectorService,
    protected environmentService: EnvironmentService,
    protected stateService: StateService,
    protected twoFactorService: TwoFactorService,
    protected i18nService: I18nService,
    protected encryptService: EncryptService,
    protected passwordStrengthService: PasswordStrengthServiceAbstraction,
    protected policyService: PolicyService,
    protected deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    protected authReqCryptoService: AuthRequestCryptoServiceAbstraction
  ) {}

  async logIn(
    credentials:
      | UserApiLogInCredentials
      | PasswordLogInCredentials
      | SsoLogInCredentials
      | PasswordlessLogInCredentials
  ): Promise<AuthResult> {
    this.clearState();

    let strategy:
      | UserApiLogInStrategy
      | PasswordLogInStrategy
      | SsoLogInStrategy
      | PasswordlessLogInStrategy;

    switch (credentials.type) {
      case AuthenticationType.Password:
        strategy = new PasswordLogInStrategy(
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
          this.passwordStrengthService,
          this.policyService,
          this
        );
        break;
      case AuthenticationType.Sso:
        strategy = new SsoLogInStrategy(
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
          this.keyConnectorService,
          this.deviceTrustCryptoService,
          this.authReqCryptoService,
          this.i18nService
        );
        break;
      case AuthenticationType.UserApi:
        strategy = new UserApiLogInStrategy(
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
          this.environmentService,
          this.keyConnectorService
        );
        break;
      case AuthenticationType.Passwordless:
        strategy = new PasswordlessLogInStrategy(
          this.cryptoService,
          this.apiService,
          this.tokenService,
          this.appIdService,
          this.platformUtilsService,
          this.messagingService,
          this.logService,
          this.stateService,
          this.twoFactorService,
          this.deviceTrustCryptoService
        );
        break;
    }

    const result = await strategy.logIn(credentials as any);

    if (result?.requiresTwoFactor) {
      this.saveState(strategy);
    }
    return result;
  }

  async logInTwoFactor(
    twoFactor: TokenTwoFactorRequest,
    captchaResponse: string
  ): Promise<AuthResult> {
    if (this.logInStrategy == null) {
      throw new Error(this.i18nService.t("sessionTimeout"));
    }

    try {
      const result = await this.logInStrategy.logInTwoFactor(twoFactor, captchaResponse);

      // Only clear state if 2FA token has been accepted, otherwise we need to be able to try again
      if (!result.requiresTwoFactor && !result.requiresCaptcha) {
        this.clearState();
      }
      return result;
    } catch (e) {
      // API exceptions are okay, but if there are any unhandled client-side errors then clear state to be safe
      if (!(e instanceof ErrorResponse)) {
        this.clearState();
      }
      throw e;
    }
  }

  logOut(callback: () => void) {
    callback();
    this.messagingService.send("loggedOut");
  }

  authingWithUserApiKey(): boolean {
    return this.logInStrategy instanceof UserApiLogInStrategy;
  }

  authingWithSso(): boolean {
    return this.logInStrategy instanceof SsoLogInStrategy;
  }

  authingWithPassword(): boolean {
    return this.logInStrategy instanceof PasswordLogInStrategy;
  }

  authingWithPasswordless(): boolean {
    return this.logInStrategy instanceof PasswordlessLogInStrategy;
  }

  async getAuthStatus(userId?: string): Promise<AuthenticationStatus> {
    // If we don't have an access token or userId, we're logged out
    const isAuthenticated = await this.stateService.getIsAuthenticated({ userId: userId });
    if (!isAuthenticated) {
      return AuthenticationStatus.LoggedOut;
    }

    // If we don't have a user key in memory, we're locked
    if (!(await this.cryptoService.hasUserKeyInMemory(userId))) {
      // Check if the user has vault timeout set to never and verify that
      // they've never unlocked their vault
      const neverLock =
        (await this.cryptoService.hasUserKeyStored(KeySuffixOptions.Auto, userId)) &&
        !(await this.stateService.getEverBeenUnlocked({ userId: userId }));

      if (neverLock) {
        // Attempt to get the key from storage and set it in memory
        const userKey = await this.cryptoService.getUserKeyFromStorage(
          KeySuffixOptions.Auto,
          userId
        );
        await this.cryptoService.setUserKey(userKey, userId);
      }
    }

    // We do another check here in case setting the auto key failed
    const hasKeyInMemory = await this.cryptoService.hasUserKeyInMemory(userId);
    if (!hasKeyInMemory) {
      return AuthenticationStatus.Locked;
    }

    return AuthenticationStatus.Unlocked;
  }

  async makePreloginKey(masterPassword: string, email: string): Promise<MasterKey> {
    email = email.trim().toLowerCase();
    let kdf: KdfType = null;
    let kdfConfig: KdfConfig = null;
    try {
      const preloginResponse = await this.apiService.postPrelogin(new PreloginRequest(email));
      if (preloginResponse != null) {
        kdf = preloginResponse.kdf;
        kdfConfig = new KdfConfig(
          preloginResponse.kdfIterations,
          preloginResponse.kdfMemory,
          preloginResponse.kdfParallelism
        );
      }
    } catch (e) {
      if (e == null || e.statusCode !== 404) {
        throw e;
      }
    }
    return await this.cryptoService.makeMasterKey(masterPassword, email, kdf, kdfConfig);
  }

  async authResponsePushNotification(notification: AuthRequestPushNotification): Promise<any> {
    this.pushNotificationSubject.next(notification.id);
  }

  getPushNotificationObs$(): Observable<any> {
    return this.pushNotificationSubject.asObservable();
  }

  async passwordlessLogin(
    id: string,
    key: string,
    requestApproved: boolean
  ): Promise<AuthRequestResponse> {
    const pubKey = Utils.fromB64ToArray(key);

    const masterKey = await this.cryptoService.getMasterKey();
    let keyToEncrypt;
    let encryptedMasterKeyHash = null;

    if (masterKey) {
      keyToEncrypt = masterKey.encKey;

      // Only encrypt the master password hash if masterKey exists as
      // we won't have a masterKeyHash without a masterKey
      const masterKeyHash = await this.stateService.getKeyHash();
      if (masterKeyHash != null) {
        encryptedMasterKeyHash = await this.cryptoService.rsaEncrypt(
          Utils.fromUtf8ToArray(masterKeyHash),
          pubKey
        );
      }
    } else {
      const userKey = await this.cryptoService.getUserKey();
      keyToEncrypt = userKey.key;
    }

    const encryptedKey = await this.cryptoService.rsaEncrypt(keyToEncrypt, pubKey);

    const request = new PasswordlessAuthRequest(
      encryptedKey.encryptedString,
      encryptedMasterKeyHash?.encryptedString,
      await this.appIdService.getAppId(),
      requestApproved
    );
    return await this.apiService.putAuthRequest(id, request);
  }

  private saveState(
    strategy:
      | UserApiLogInStrategy
      | PasswordLogInStrategy
      | SsoLogInStrategy
      | PasswordlessLogInStrategy
  ) {
    this.logInStrategy = strategy;
    this.startSessionTimeout();
  }

  private clearState() {
    this.logInStrategy = null;
    this.clearSessionTimeout();
  }

  private startSessionTimeout() {
    this.clearSessionTimeout();
    this.sessionTimeout = setTimeout(() => this.clearState(), sessionTimeoutLength);
  }

  private clearSessionTimeout() {
    if (this.sessionTimeout != null) {
      clearTimeout(this.sessionTimeout);
    }
  }
}
