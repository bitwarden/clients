import { ApiService } from "../../abstractions/api.service";
import { ClientType } from "../../enums";
import { KeysRequest } from "../../models/request/keys.request";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import {
  Account,
  AccountDecryptionOptions,
  AccountKeys,
  AccountProfile,
  AccountTokens,
} from "../../platform/models/domain/account";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/two-factor.service";
import { TwoFactorProviderType } from "../enums/two-factor-provider-type";
import { AuthResult } from "../models/domain/auth-result";
import { ForceResetPasswordReason } from "../models/domain/force-reset-password-reason";
import {
  PasswordlessLogInCredentials,
  PasswordLogInCredentials,
  SsoLogInCredentials,
  UserApiLogInCredentials,
} from "../models/domain/log-in-credentials";
import { DeviceRequest } from "../models/request/identity-token/device.request";
import { PasswordTokenRequest } from "../models/request/identity-token/password-token.request";
import { SsoTokenRequest } from "../models/request/identity-token/sso-token.request";
import { TokenTwoFactorRequest } from "../models/request/identity-token/token-two-factor.request";
import { UserApiTokenRequest } from "../models/request/identity-token/user-api-token.request";
import { IdentityCaptchaResponse } from "../models/response/identity-captcha.response";
import { IdentityTokenResponse } from "../models/response/identity-token.response";
import { IdentityTwoFactorResponse } from "../models/response/identity-two-factor.response";

type IdentityResponse = IdentityTokenResponse | IdentityTwoFactorResponse | IdentityCaptchaResponse;

export abstract class LogInStrategy {
  protected abstract tokenRequest: UserApiTokenRequest | PasswordTokenRequest | SsoTokenRequest;
  protected captchaBypassToken: string = null;

  constructor(
    protected cryptoService: CryptoService,
    protected apiService: ApiService,
    protected tokenService: TokenService,
    protected appIdService: AppIdService,
    protected platformUtilsService: PlatformUtilsService,
    protected messagingService: MessagingService,
    protected logService: LogService,
    protected stateService: StateService,
    protected twoFactorService: TwoFactorService
  ) {}

  abstract logIn(
    credentials:
      | UserApiLogInCredentials
      | PasswordLogInCredentials
      | SsoLogInCredentials
      | PasswordlessLogInCredentials
  ): Promise<AuthResult>;

  async logInTwoFactor(
    twoFactor: TokenTwoFactorRequest,
    captchaResponse: string = null
  ): Promise<AuthResult> {
    this.tokenRequest.setTwoFactor(twoFactor);
    const [authResult] = await this.startLogIn();
    return authResult;
  }

  protected async startLogIn(): Promise<[AuthResult, IdentityResponse]> {
    this.twoFactorService.clearSelectedProvider();

    const response = await this.apiService.postIdentityToken(this.tokenRequest);

    if (response instanceof IdentityTwoFactorResponse) {
      return [await this.processTwoFactorResponse(response), response];
    } else if (response instanceof IdentityCaptchaResponse) {
      return [await this.processCaptchaResponse(response), response];
    } else if (response instanceof IdentityTokenResponse) {
      return [await this.processTokenResponse(response), response];
    }

    throw new Error("Invalid response object.");
  }

  protected async buildDeviceRequest() {
    const appId = await this.appIdService.getAppId();
    return new DeviceRequest(appId, this.platformUtilsService);
  }

  protected async buildTwoFactor(userProvidedTwoFactor?: TokenTwoFactorRequest) {
    if (userProvidedTwoFactor != null) {
      return userProvidedTwoFactor;
    }

    const storedTwoFactorToken = await this.tokenService.getTwoFactorToken();
    if (storedTwoFactorToken != null) {
      return new TokenTwoFactorRequest(TwoFactorProviderType.Remember, storedTwoFactorToken, false);
    }

    return new TokenTwoFactorRequest();
  }

  protected async saveAccountInformation(tokenResponse: IdentityTokenResponse) {
    const accountInformation = await this.tokenService.decodeToken(tokenResponse.accessToken);

    // Must persist existing device key if it exists for trusted device decryption to work
    // However, we must provide a user id so that the device key can be retrieved
    // as the state service won't have an active account at this point in time
    // even though the data exists in local storage.
    const userId = accountInformation.sub;

    const deviceKey = await this.stateService.getDeviceKey({ userId });
    const accountKeys = new AccountKeys();
    if (deviceKey) {
      accountKeys.deviceKey = deviceKey;
    }

    // If you don't persist existing admin auth requests on login, they will get deleted.
    const adminAuthRequest = await this.stateService.getAdminAuthRequest({ userId });

    await this.stateService.addAccount(
      new Account({
        profile: {
          ...new AccountProfile(),
          ...{
            userId,
            name: accountInformation.name,
            email: accountInformation.email,
            hasPremiumPersonally: accountInformation.premium,
            kdfIterations: tokenResponse.kdfIterations,
            kdfMemory: tokenResponse.kdfMemory,
            kdfParallelism: tokenResponse.kdfParallelism,
            kdfType: tokenResponse.kdf,
          },
        },
        tokens: {
          ...new AccountTokens(),
          ...{
            accessToken: tokenResponse.accessToken,
            refreshToken: tokenResponse.refreshToken,
          },
        },
        keys: accountKeys,
        decryptionOptions: AccountDecryptionOptions.fromResponse(tokenResponse),
        adminAuthRequest: adminAuthRequest?.toJSON(),
      })
    );
  }

  protected async processTokenResponse(response: IdentityTokenResponse): Promise<AuthResult> {
    const result = new AuthResult();

    // Old encryption keys must be migrated, but is currently only available on web.
    // Other clients shouldn't continue the login process.
    if (this.encryptionKeyMigrationRequired(response)) {
      result.requiresEncryptionKeyMigration = true;
      if (this.platformUtilsService.getClientType() !== ClientType.Web) {
        return result;
      }
    }

    result.resetMasterPassword = response.resetMasterPassword;

    // Convert boolean to enum
    if (response.forcePasswordReset) {
      result.forcePasswordReset = ForceResetPasswordReason.AdminForcePasswordReset;
    }

    // Must come before setting keys, user key needs email to update additional keys
    await this.saveAccountInformation(response);

    if (response.twoFactorToken != null) {
      await this.tokenService.setTwoFactorToken(response);
    }

    await this.setMasterKey(response);
    await this.setUserKey(response);
    await this.setPrivateKey(response);

    this.messagingService.send("loggedIn");

    return result;
  }

  // The keys comes from different sources depending on the login strategy
  protected abstract setMasterKey(response: IdentityTokenResponse): Promise<void>;

  protected abstract setUserKey(response: IdentityTokenResponse): Promise<void>;

  protected abstract setPrivateKey(response: IdentityTokenResponse): Promise<void>;

  // Old accounts used master key for encryption. We are forcing migrations but only need to
  // check on password logins
  protected encryptionKeyMigrationRequired(response: IdentityTokenResponse): boolean {
    return false;
  }

  protected async createKeyPairForOldAccount() {
    try {
      const [publicKey, privateKey] = await this.cryptoService.makeKeyPair();
      await this.apiService.postAccountKeys(new KeysRequest(publicKey, privateKey.encryptedString));
      return privateKey.encryptedString;
    } catch (e) {
      this.logService.error(e);
    }
  }

  private async processTwoFactorResponse(response: IdentityTwoFactorResponse): Promise<AuthResult> {
    const result = new AuthResult();
    result.twoFactorProviders = response.twoFactorProviders2;

    this.twoFactorService.setProviders(response);
    this.captchaBypassToken = response.captchaToken ?? null;
    result.ssoEmail2FaSessionToken = response.ssoEmail2faSessionToken;
    result.email = response.email;
    return result;
  }

  private async processCaptchaResponse(response: IdentityCaptchaResponse): Promise<AuthResult> {
    const result = new AuthResult();
    result.captchaSiteKey = response.siteKey;
    return result;
  }
}
