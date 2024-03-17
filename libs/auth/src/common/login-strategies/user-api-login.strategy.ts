import { BehaviorSubject } from "rxjs";
import { Jsonify } from "type-fest";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { UserApiTokenRequest } from "@bitwarden/common/auth/models/request/identity-token/user-api-token.request";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";

import { UserApiLoginCredentials } from "../models/domain/login-credentials";
import { CacheData } from "../services/login-strategies/login-strategy.state";

import { LoginStrategy, LoginStrategyData } from "./login.strategy";

export class UserApiLoginStrategyData implements LoginStrategyData {
  tokenRequest: UserApiTokenRequest;
  captchaBypassToken: string;

  static fromJSON(obj: Jsonify<UserApiLoginStrategyData>): UserApiLoginStrategyData {
    return Object.assign(new UserApiLoginStrategyData(), obj, {
      tokenRequest: UserApiTokenRequest.fromJSON(obj.tokenRequest),
    });
  }
}

export class UserApiLoginStrategy extends LoginStrategy {
  protected cache: BehaviorSubject<UserApiLoginStrategyData>;

  constructor(
    data: UserApiLoginStrategyData,
    cryptoService: CryptoService,
    apiService: ApiService,
    tokenService: TokenService,
    appIdService: AppIdService,
    platformUtilsService: PlatformUtilsService,
    messagingService: MessagingService,
    logService: LogService,
    stateService: StateService,
    twoFactorService: TwoFactorService,
    private environmentService: EnvironmentService,
    private keyConnectorService: KeyConnectorService,
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
      billingAccountProfileStateService,
    );
    this.cache = new BehaviorSubject(data);
  }

  override async logIn(credentials: UserApiLoginCredentials) {
    const data = new UserApiLoginStrategyData();
    data.tokenRequest = new UserApiTokenRequest(
      credentials.clientId,
      credentials.clientSecret,
      await this.buildTwoFactor(),
      await this.buildDeviceRequest(),
    );
    this.cache.next(data);

    const [authResult] = await this.startLogIn();
    return authResult;
  }

  protected override async setMasterKey(response: IdentityTokenResponse) {
    if (response.apiUseKeyConnector) {
      const keyConnectorUrl = this.environmentService.getKeyConnectorUrl();
      await this.keyConnectorService.setMasterKeyFromUrl(keyConnectorUrl);
    }
  }

  protected override async setUserKey(response: IdentityTokenResponse): Promise<void> {
    await this.cryptoService.setMasterKeyEncryptedUserKey(response.key);

    if (response.apiUseKeyConnector) {
      const masterKey = await this.cryptoService.getMasterKey();
      if (masterKey) {
        const userKey = await this.cryptoService.decryptUserKeyWithMasterKey(masterKey);
        await this.cryptoService.setUserKey(userKey);
      }
    }
  }

  protected override async setPrivateKey(response: IdentityTokenResponse): Promise<void> {
    await this.cryptoService.setPrivateKey(
      response.privateKey ?? (await this.createKeyPairForOldAccount()),
    );
  }

  protected async saveAccountInformation(tokenResponse: IdentityTokenResponse) {
    await super.saveAccountInformation(tokenResponse);

    const vaultTimeout = await this.stateService.getVaultTimeout();
    const vaultTimeoutAction = await this.stateService.getVaultTimeoutAction();

    const tokenRequest = this.cache.value.tokenRequest;

    await this.tokenService.setClientId(
      tokenRequest.clientId,
      vaultTimeoutAction as VaultTimeoutAction,
      vaultTimeout,
    );
    await this.tokenService.setClientSecret(
      tokenRequest.clientSecret,
      vaultTimeoutAction as VaultTimeoutAction,
      vaultTimeout,
    );
  }

  exportCache(): CacheData {
    return {
      userApiKey: this.cache.value,
    };
  }
}
