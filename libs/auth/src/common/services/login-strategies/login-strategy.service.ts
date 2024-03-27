import {
  combineLatestWith,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
} from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PolicyService } from "@bitwarden/common/admin-console/abstractions/policy/policy.service.abstraction";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthenticationType } from "@bitwarden/common/auth/enums/authentication-type";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { KdfConfig } from "@bitwarden/common/auth/models/domain/kdf-config";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { PasswordlessAuthRequest } from "@bitwarden/common/auth/models/request/passwordless-auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { PreloginRequest } from "@bitwarden/common/models/request/prelogin.request";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { AuthRequestPushNotification } from "@bitwarden/common/models/response/notification.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EncryptService } from "@bitwarden/common/platform/abstractions/encrypt.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { KdfType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { GlobalState, GlobalStateProvider } from "@bitwarden/common/platform/state";
import { PasswordStrengthServiceAbstraction } from "@bitwarden/common/tools/password-strength";
import { MasterKey } from "@bitwarden/common/types/key";

import { AuthRequestServiceAbstraction, LoginStrategyServiceAbstraction } from "../../abstractions";
import { InternalUserDecryptionOptionsServiceAbstraction } from "../../abstractions/user-decryption-options.service.abstraction";
import { AuthRequestLoginStrategy } from "../../login-strategies/auth-request-login.strategy";
import { PasswordLoginStrategy } from "../../login-strategies/password-login.strategy";
import { SsoLoginStrategy } from "../../login-strategies/sso-login.strategy";
import { UserApiLoginStrategy } from "../../login-strategies/user-api-login.strategy";
import { WebAuthnLoginStrategy } from "../../login-strategies/webauthn-login.strategy";
import {
  UserApiLoginCredentials,
  PasswordLoginCredentials,
  SsoLoginCredentials,
  AuthRequestLoginCredentials,
  WebAuthnLoginCredentials,
} from "../../models";

import {
  AUTH_REQUEST_PUSH_NOTIFICATION_KEY,
  CURRENT_LOGIN_STRATEGY_KEY,
  CacheData,
  CACHE_EXPIRATION_KEY,
  CACHE_KEY,
} from "./login-strategy.state";

const sessionTimeoutLength = 2 * 60 * 1000; // 2 minutes

export class LoginStrategyService implements LoginStrategyServiceAbstraction {
  private sessionTimeout: unknown;
  private currentAuthnTypeState: GlobalState<AuthenticationType | null>;
  private loginStrategyCacheState: GlobalState<CacheData | null>;
  private loginStrategyCacheExpirationState: GlobalState<Date | null>;
  private authRequestPushNotificationState: GlobalState<string>;

  private loginStrategy$: Observable<
    | UserApiLoginStrategy
    | PasswordLoginStrategy
    | SsoLoginStrategy
    | AuthRequestLoginStrategy
    | WebAuthnLoginStrategy
    | null
  >;

  currentAuthType$: Observable<AuthenticationType | null>;
  // TODO: move to auth request service
  authRequestPushNotification$: Observable<string>;

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
    protected authRequestService: AuthRequestServiceAbstraction,
    protected userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    protected stateProvider: GlobalStateProvider,
    protected billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    this.currentAuthnTypeState = this.stateProvider.get(CURRENT_LOGIN_STRATEGY_KEY);
    this.loginStrategyCacheState = this.stateProvider.get(CACHE_KEY);
    this.loginStrategyCacheExpirationState = this.stateProvider.get(CACHE_EXPIRATION_KEY);
    this.authRequestPushNotificationState = this.stateProvider.get(
      AUTH_REQUEST_PUSH_NOTIFICATION_KEY,
    );

    this.currentAuthType$ = this.currentAuthnTypeState.state$;
    this.authRequestPushNotification$ = this.authRequestPushNotificationState.state$.pipe(
      filter((id) => id != null),
    );
    this.loginStrategy$ = this.currentAuthnTypeState.state$.pipe(
      distinctUntilChanged(),
      combineLatestWith(this.loginStrategyCacheState.state$),
      this.initializeLoginStrategy.bind(this),
      shareReplay({ refCount: true, bufferSize: 1 }),
    );
  }

  async getEmail(): Promise<string | null> {
    const strategy = await firstValueFrom(this.loginStrategy$);

    if ("email$" in strategy) {
      return await firstValueFrom(strategy.email$);
    }
    return null;
  }

  async getMasterPasswordHash(): Promise<string | null> {
    const strategy = await firstValueFrom(this.loginStrategy$);

    if ("masterKeyHash$" in strategy) {
      return await firstValueFrom(strategy.masterKeyHash$);
    }
    return null;
  }

  async getSsoEmail2FaSessionToken(): Promise<string | null> {
    const strategy = await firstValueFrom(this.loginStrategy$);

    if ("ssoEmail2FaSessionToken$" in strategy) {
      return await firstValueFrom(strategy.ssoEmail2FaSessionToken$);
    }
    return null;
  }

  async getAccessCode(): Promise<string | null> {
    const strategy = await firstValueFrom(this.loginStrategy$);

    if ("accessCode$" in strategy) {
      return await firstValueFrom(strategy.accessCode$);
    }
    return null;
  }

  async getAuthRequestId(): Promise<string | null> {
    const strategy = await firstValueFrom(this.loginStrategy$);

    if ("authRequestId$" in strategy) {
      return await firstValueFrom(strategy.authRequestId$);
    }
    return null;
  }

  async logIn(
    credentials:
      | UserApiLoginCredentials
      | PasswordLoginCredentials
      | SsoLoginCredentials
      | AuthRequestLoginCredentials
      | WebAuthnLoginCredentials,
  ): Promise<AuthResult> {
    await this.clearCache();

    await this.currentAuthnTypeState.update((_) => credentials.type);

    const strategy = await firstValueFrom(this.loginStrategy$);

    // Note: We aren't passing the credentials directly to the strategy since they are
    // created in the popup and can cause DeadObject references on Firefox.
    // This is a shallow copy, but use deep copy in future if objects are added to credentials
    // that were created in popup.
    // If the popup uses its own instance of this service, this can be removed.
    const ownedCredentials = { ...credentials };

    const result = await strategy.logIn(ownedCredentials as any);

    if (result != null && !result.requiresTwoFactor) {
      await this.clearCache();
    } else {
      // Cache the strategy data so we can attempt again later with 2fa. Cache supports different contexts
      await this.loginStrategyCacheState.update((_) => strategy.exportCache());
      await this.startSessionTimeout();
    }

    return result;
  }

  async logInTwoFactor(
    twoFactor: TokenTwoFactorRequest,
    captchaResponse: string,
  ): Promise<AuthResult> {
    if (!(await this.isSessionValid())) {
      throw new Error(this.i18nService.t("sessionTimeout"));
    }

    const strategy = await firstValueFrom(this.loginStrategy$);
    if (strategy == null) {
      throw new Error("No login strategy found.");
    }

    try {
      const result = await strategy.logInTwoFactor(twoFactor, captchaResponse);

      // Only clear cache if 2FA token has been accepted, otherwise we need to be able to try again
      if (result != null && !result.requiresTwoFactor && !result.requiresCaptcha) {
        await this.clearCache();
      }
      return result;
    } catch (e) {
      // API exceptions are okay, but if there are any unhandled client-side errors then clear cache to be safe
      if (!(e instanceof ErrorResponse)) {
        await this.clearCache();
      }
      throw e;
    }
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
          preloginResponse.kdfParallelism,
        );
      }
    } catch (e) {
      if (e == null || e.statusCode !== 404) {
        throw e;
      }
    }
    return await this.cryptoService.makeMasterKey(masterPassword, email, kdf, kdfConfig);
  }

  // TODO move to auth request service
  async sendAuthRequestPushNotification(notification: AuthRequestPushNotification): Promise<void> {
    if (notification.id != null) {
      await this.authRequestPushNotificationState.update((_) => notification.id);
    }
  }

  // TODO: move to auth request service
  async passwordlessLogin(
    id: string,
    key: string,
    requestApproved: boolean,
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
          pubKey,
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
      requestApproved,
    );
    return await this.apiService.putAuthRequest(id, request);
  }

  private async clearCache(): Promise<void> {
    await this.currentAuthnTypeState.update((_) => null);
    await this.loginStrategyCacheState.update((_) => null);
    await this.clearSessionTimeout();
  }

  private async startSessionTimeout(): Promise<void> {
    await this.clearSessionTimeout();
    await this.loginStrategyCacheExpirationState.update(
      (_) => new Date(Date.now() + sessionTimeoutLength),
    );
    this.sessionTimeout = setTimeout(() => this.clearCache(), sessionTimeoutLength);
  }

  private async clearSessionTimeout(): Promise<void> {
    await this.loginStrategyCacheExpirationState.update((_) => null);
    this.sessionTimeout = null;
  }

  private async isSessionValid(): Promise<boolean> {
    const cache = await firstValueFrom(this.loginStrategyCacheState.state$);
    if (cache == null) {
      return false;
    }
    const expiration = await firstValueFrom(this.loginStrategyCacheExpirationState.state$);
    if (expiration != null && expiration < new Date()) {
      await this.clearCache();
      return false;
    }
    return true;
  }

  private initializeLoginStrategy(
    source: Observable<[AuthenticationType | null, CacheData | null]>,
  ) {
    return source.pipe(
      map(([strategy, data]) => {
        if (strategy == null) {
          return null;
        }
        switch (strategy) {
          case AuthenticationType.Password:
            return new PasswordLoginStrategy(
              data?.password,
              this.cryptoService,
              this.apiService,
              this.tokenService,
              this.appIdService,
              this.platformUtilsService,
              this.messagingService,
              this.logService,
              this.stateService,
              this.twoFactorService,
              this.userDecryptionOptionsService,
              this.passwordStrengthService,
              this.policyService,
              this,
              this.billingAccountProfileStateService,
            );
          case AuthenticationType.Sso:
            return new SsoLoginStrategy(
              data?.sso,
              this.cryptoService,
              this.apiService,
              this.tokenService,
              this.appIdService,
              this.platformUtilsService,
              this.messagingService,
              this.logService,
              this.stateService,
              this.twoFactorService,
              this.userDecryptionOptionsService,
              this.keyConnectorService,
              this.deviceTrustCryptoService,
              this.authRequestService,
              this.i18nService,
              this.billingAccountProfileStateService,
            );
          case AuthenticationType.UserApiKey:
            return new UserApiLoginStrategy(
              data?.userApiKey,
              this.cryptoService,
              this.apiService,
              this.tokenService,
              this.appIdService,
              this.platformUtilsService,
              this.messagingService,
              this.logService,
              this.stateService,
              this.twoFactorService,
              this.userDecryptionOptionsService,
              this.environmentService,
              this.keyConnectorService,
              this.billingAccountProfileStateService,
            );
          case AuthenticationType.AuthRequest:
            return new AuthRequestLoginStrategy(
              data?.authRequest,
              this.cryptoService,
              this.apiService,
              this.tokenService,
              this.appIdService,
              this.platformUtilsService,
              this.messagingService,
              this.logService,
              this.stateService,
              this.twoFactorService,
              this.userDecryptionOptionsService,
              this.deviceTrustCryptoService,
              this.billingAccountProfileStateService,
            );
          case AuthenticationType.WebAuthn:
            return new WebAuthnLoginStrategy(
              data?.webAuthn,
              this.cryptoService,
              this.apiService,
              this.tokenService,
              this.appIdService,
              this.platformUtilsService,
              this.messagingService,
              this.logService,
              this.stateService,
              this.twoFactorService,
              this.userDecryptionOptionsService,
              this.billingAccountProfileStateService,
            );
        }
      }),
    );
  }
}
