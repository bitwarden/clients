// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BehaviorSubject } from "rxjs";
import { Jsonify } from "type-fest";

import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { WebAuthnLoginTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/webauthn-login-token.request";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

import { WebAuthnLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { LoginStrategy, LoginStrategyData } from "./login.strategy";

export class WebAuthnLoginStrategyData implements LoginStrategyData {
  tokenRequest: WebAuthnLoginTokenRequest;
  captchaBypassToken?: string;
  credentials: WebAuthnLoginCredentials;

  static fromJSON(obj: Jsonify<WebAuthnLoginStrategyData>): WebAuthnLoginStrategyData {
    return Object.assign(new WebAuthnLoginStrategyData(), obj, {
      tokenRequest: WebAuthnLoginTokenRequest.fromJSON(obj.tokenRequest),
      credentials: WebAuthnLoginCredentials.fromJSON(obj.credentials),
    });
  }
}

export class WebAuthnLoginStrategy extends LoginStrategy {
  protected cache: BehaviorSubject<WebAuthnLoginStrategyData>;

  constructor(
    data: WebAuthnLoginStrategyData,
    ...sharedDeps: ConstructorParameters<typeof LoginStrategy>
  ) {
    super(...sharedDeps);

    this.cache = new BehaviorSubject(data);
  }

  async logIn(credentials: WebAuthnLoginCredentials) {
    const data = new WebAuthnLoginStrategyData();
    data.credentials = credentials;
    data.tokenRequest = new WebAuthnLoginTokenRequest(
      credentials.token,
      credentials.deviceResponse,
      await this.buildDeviceRequest(),
    );
    this.cache.next(data);

    const [authResult] = await this.startLogIn();
    return authResult;
  }

  async logInTwoFactor(): Promise<AuthResult> {
    throw new Error("2FA not supported yet for WebAuthn Login.");
  }

  protected override async setMasterKey(response: IdentityTokenResponse, userId: UserId) {
    return Promise.resolve();
  }

  protected override async setUserKey(idTokenResponse: IdentityTokenResponse, userId: UserId) {
    const masterKeyEncryptedUserKey = idTokenResponse.key;

    if (masterKeyEncryptedUserKey) {
      // set the master key encrypted user key if it exists
      await this.keyService.setMasterKeyEncryptedUserKey(masterKeyEncryptedUserKey, userId);
    }

    const userDecryptionOptions = idTokenResponse?.userDecryptionOptions;

    if (userDecryptionOptions?.webAuthnPrfOption) {
      const webAuthnPrfOption = idTokenResponse.userDecryptionOptions?.webAuthnPrfOption;

      const credentials = this.cache.value.credentials;
      // confirm we still have the prf key
      if (!credentials.prfKey) {
        return;
      }

      // decrypt prf encrypted private key
      const privateKey = await this.encryptService.decryptToBytes(
        webAuthnPrfOption.encryptedPrivateKey,
        credentials.prfKey,
      );

      // decrypt user key with private key
      const userKey = await this.encryptService.rsaDecrypt(
        new EncString(webAuthnPrfOption.encryptedUserKey.encryptedString),
        privateKey,
      );

      if (userKey) {
        await this.keyService.setUserKey(new SymmetricCryptoKey(userKey) as UserKey, userId);
      }
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
      webAuthn: this.cache.value,
    };
  }
}
