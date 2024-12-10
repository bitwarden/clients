// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom, Observable, map, BehaviorSubject } from "rxjs";
import { Jsonify } from "type-fest";

import { DeviceTrustServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust.service.abstraction";
import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { PasswordTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/password-token.request";
import { TokenTwoFactorRequest } from "@bitwarden/common/auth/models/request/identity-token/token-two-factor.request";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { UserId } from "@bitwarden/common/types/guid";

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
    private deviceTrustService: DeviceTrustServiceAbstraction,
    ...sharedDeps: ConstructorParameters<typeof LoginStrategy>
  ) {
    super(...sharedDeps);

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

  protected override async setMasterKey(response: IdentityTokenResponse, userId: UserId) {
    const authRequestCredentials = this.cache.value.authRequestCredentials;
    if (
      authRequestCredentials.decryptedMasterKey &&
      authRequestCredentials.decryptedMasterKeyHash
    ) {
      await this.masterPasswordService.setMasterKey(
        authRequestCredentials.decryptedMasterKey,
        userId,
      );
      await this.masterPasswordService.setMasterKeyHash(
        authRequestCredentials.decryptedMasterKeyHash,
        userId,
      );
    }
  }

  protected override async setUserKey(
    response: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    const authRequestCredentials = this.cache.value.authRequestCredentials;
    // User now may or may not have a master password
    // but set the master key encrypted user key if it exists regardless
    await this.keyService.setMasterKeyEncryptedUserKey(response.key, userId);

    if (authRequestCredentials.decryptedUserKey) {
      await this.keyService.setUserKey(authRequestCredentials.decryptedUserKey, userId);
    } else {
      await this.trySetUserKeyWithMasterKey(userId);

      // Establish trust if required after setting user key
      await this.deviceTrustService.trustDeviceIfRequired(userId);
    }
  }

  private async trySetUserKeyWithMasterKey(userId: UserId): Promise<void> {
    const masterKey = await firstValueFrom(this.masterPasswordService.masterKey$(userId));
    if (masterKey) {
      const userKey = await this.masterPasswordService.decryptUserKeyWithMasterKey(
        masterKey,
        userId,
      );
      await this.keyService.setUserKey(userKey, userId);
    }
  }

  protected override async setPrivateKey(
    response: IdentityTokenResponse,
    userId: UserId,
  ): Promise<void> {
    await this.keyService.setPrivateKey(
      response.privateKey ?? (await this.createKeyPairForOldAccount(userId)),
      userId,
    );
  }

  exportCache(): CacheData {
    return {
      authRequest: this.cache.value,
    };
  }
}
