import { Observable, map, BehaviorSubject } from "rxjs";
import { Jsonify } from "type-fest";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { UserId } from "@bitwarden/common/types/guid";

import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { AuthRequestLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { LoginStrategy, LoginStrategyData } from "./login.strategy";

export class AuthRequestLoginStrategyData implements LoginStrategyData {
  tokenRequest: PasswordTokenRequest;
  captchaBypassToken: string;
  authRequestCredentials: AuthRequestLoginCredentials;

  static fromJSON(obj: Jsonify<AuthRequestLoginStrategyData>): AuthRequestLoginStrategyData {
    const data = Object.assign(new AuthRequestLoginStrategyData(), obj, {
      tokenRequest: PasswordTokenRequest.fromJSON(obj.tokenRequest),
      authRequestCredentials: AuthRequestLoginCredentials.fromJSON(obj.authRequestCredentials),
    });
    return data;
  }
}

export class AuthRequestLoginStrategy extends LoginStrategy {
  email$: Observable<string>;
  accessCode$: Observable<string>;
  authRequestId$: Observable<string>;

  protected cache: BehaviorSubject<AuthRequestLoginStrategyData>;

  constructor(
    data: AuthRequestLoginStrategyData,
    cryptoService: CryptoService,
    apiService: ApiService,
    tokenService: TokenService,
    appIdService: AppIdService,
    platformUtilsService: PlatformUtilsService,
    messagingService: MessagingService,
    logService: LogService,
    stateService: StateService,
    twoFactorService: TwoFactorService,
    userDecryptionOptionsService: InternalUserDecryptionOptionsServiceAbstraction,
    private deviceTrustCryptoService: DeviceTrustCryptoServiceAbstraction,
    billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
    super(
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService,
      userDecryptionOptionsService,
      billingAccountProfileStateService,
    );

    this.cache = new BehaviorSubject(data);
    this.email$ = this.cache.pipe(map((data) => data.tokenRequest.email));
    this.accessCode$ = this.cache.pipe(map((data) => data.authRequestCredentials.accessCode));
    this.authRequestId$ = this.cache.pipe(map((data) => data.authRequestCredentials.authRequestId));
  }

  override async logIn(credentials: AuthRequestLoginCredentials) {
    const data = new AuthRequestLoginStrategyData();
    data.tokenRequest = new PasswordTokenRequest(
      credentials.email,
      credentials.accessCode,
      null,
      await this.buildTwoFactor(credentials.twoFactor, credentials.email),
      await this.buildDeviceRequest(),
    );
    data.tokenRequest.setAuthRequestAccessCode(credentials.authRequestId);
    data.authRequestCredentials = credentials;
    this.cache.next(data);

    const [authResult] = await this.startLogIn();
    return authResult;
  }

  override async logInTwoFactor(
    twoFactor: TokenTwoFactorRequest,
    captchaResponse: string,
  ): Promise<AuthResult> {
    const data = this.cache.value;
    data.tokenRequest.captchaResponse = captchaResponse ?? data.captchaBypassToken;
    this.cache.next(data);

    return super.logInTwoFactor(twoFactor);
  }

  protected override async setMasterKey(response: IdentityTokenResponse) {
    const authRequestCredentials = this.cache.value.authRequestCredentials;
    if (
      authRequestCredentials.decryptedMasterKey &&
      authRequestCredentials.decryptedMasterKeyHash
    ) {
      await this.cryptoService.setMasterKey(authRequestCredentials.decryptedMasterKey);
      await this.cryptoService.setMasterKeyHash(authRequestCredentials.decryptedMasterKeyHash);
    }
  }

  protected override async setUserKey(response: IdentityTokenResponse): Promise<void> {
    const authRequestCredentials = this.cache.value.authRequestCredentials;
    // User now may or may not have a master password
    // but set the master key encrypted user key if it exists regardless
    await this.cryptoService.setMasterKeyEncryptedUserKey(response.key);

    if (authRequestCredentials.decryptedUserKey) {
      await this.cryptoService.setUserKey(authRequestCredentials.decryptedUserKey);
    } else {
      await this.trySetUserKeyWithMasterKey();

      const userId = (await this.stateService.getUserId()) as UserId;
      // Establish trust if required after setting user key
      await this.deviceTrustCryptoService.trustDeviceIfRequired(userId);
    }
  }

  private async trySetUserKeyWithMasterKey(): Promise<void> {
    const masterKey = await this.cryptoService.getMasterKey();
    if (masterKey) {
      const userKey = await this.cryptoService.decryptUserKeyWithMasterKey(masterKey);
      await this.cryptoService.setUserKey(userKey);
    }
  }

  protected override async setPrivateKey(response: IdentityTokenResponse): Promise<void> {
    await this.cryptoService.setPrivateKey(
      response.privateKey ?? (await this.createKeyPairForOldAccount()),
    );
  }

  exportCache(): CacheData {
    return {
      authRequest: this.cache.value,
    };
  }
}
