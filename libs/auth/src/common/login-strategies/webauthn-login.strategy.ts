import { BehaviorSubject } from "rxjs";
import { Jsonify } from "type-fest";

import { AuthResult } from "@bitwarden/common/auth/models/domain/auth-result";
import { WebAuthnLoginTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/webauthn-login-token.request";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { UnlockService } from "@bitwarden/unlock";

import { WebAuthnLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { LoginStrategy, LoginStrategyData } from "./login.strategy";

export class WebAuthnLoginStrategyData implements LoginStrategyData {
  readonly tokenRequest: WebAuthnLoginTokenRequest;
  readonly credentials: WebAuthnLoginCredentials;

  constructor(fields: WebAuthnLoginStrategyData) {
    this.tokenRequest = fields.tokenRequest;
    this.credentials = fields.credentials;
  }

  static fromJSON(obj: Jsonify<WebAuthnLoginStrategyData>): WebAuthnLoginStrategyData {
    return new WebAuthnLoginStrategyData({
      tokenRequest: WebAuthnLoginTokenRequest.fromJSON(obj.tokenRequest),
      credentials: WebAuthnLoginCredentials.fromJSON(obj.credentials),
    });
  }
}

export class WebAuthnLoginStrategy extends LoginStrategy<WebAuthnLoginStrategyData> {
  protected cache: BehaviorSubject<WebAuthnLoginStrategyData | undefined>;

  constructor(
    data: WebAuthnLoginStrategyData | undefined,
    private unlockService: UnlockService,
    ...sharedDeps: ConstructorParameters<typeof LoginStrategy>
  ) {
    super(...sharedDeps);

    this.cache = new BehaviorSubject(data);
  }

  async logIn(credentials: WebAuthnLoginCredentials) {
    const tokenRequest = new WebAuthnLoginTokenRequest(
      credentials.token,
      credentials.deviceResponse,
      await this.buildDeviceRequest(),
    );
    this.cache.next(new WebAuthnLoginStrategyData({ tokenRequest, credentials }));

    const [authResult] = await this.startLogIn();
    return authResult;
  }

  async logInTwoFactor(): Promise<AuthResult> {
    throw new Error("2FA not supported yet for WebAuthn Login.");
  }

  protected override async unlock(idTokenResponse: IdentityTokenResponse, userId: UserId) {
    const userDecryptionOptions = idTokenResponse?.userDecryptionOptions;

    if (userDecryptionOptions?.webAuthnPrfOption) {
      const { credentials } = this.getLoginStrategyDataOrThrow();

      // confirm we still have the prf key
      if (!credentials.prfKey) {
        return;
      }

      const webAuthnPrfOption = userDecryptionOptions.webAuthnPrfOption;

      // decrypt prf encrypted private key
      const privateKey = await this.encryptService.unwrapDecapsulationKey(
        webAuthnPrfOption.encryptedPrivateKey,
        credentials.prfKey,
      );

      // decrypt user key with private key
      const userKey = await this.encryptService.decapsulateKeyUnsigned(
        webAuthnPrfOption.encryptedUserKey,
        privateKey,
      );

      if (userKey) {
        // TODO: PRF decryption should move into the SDK so this can use a dedicated PRF unlock method.
        await this.unlockService.unlockWithDecryptedUserKey(userId, userKey as UserKey);
      }
    }
  }

  exportCache(): CacheData {
    return {
      webAuthn: this.cache.value,
    };
  }
}
