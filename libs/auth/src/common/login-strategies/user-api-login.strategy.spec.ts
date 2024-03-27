import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { KeyConnectorService } from "@bitwarden/common/auth/abstractions/key-connector.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { VaultTimeoutAction } from "@bitwarden/common/enums/vault-timeout-action.enum";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import {
  Environment,
  EnvironmentService,
} from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey, MasterKey } from "@bitwarden/common/types/key";

import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { UserApiLoginCredentials } from "../models/domain/login-credentials";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { UserApiLoginStrategy, UserApiLoginStrategyData } from "./user-api-login.strategy";

describe("UserApiLoginStrategy", () => {
  let cache: UserApiLoginStrategyData;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let userDecryptionOptionsService: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let keyConnectorService: MockProxy<KeyConnectorService>;
  let environmentService: MockProxy<EnvironmentService>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;

  let apiLogInStrategy: UserApiLoginStrategy;
  let credentials: UserApiLoginCredentials;

  const userId = Utils.newGuid() as UserId;
  const deviceId = Utils.newGuid();
  const keyConnectorUrl = "KEY_CONNECTOR_URL";
  const apiClientId = "API_CLIENT_ID";
  const apiClientSecret = "API_CLIENT_SECRET";

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();

    cryptoService = mock<CryptoService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    userDecryptionOptionsService = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    keyConnectorService = mock<KeyConnectorService>();
    environmentService = mock<EnvironmentService>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();

    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.getTwoFactorToken.mockResolvedValue(null);
    tokenService.decodeAccessToken.mockResolvedValue({});

    apiLogInStrategy = new UserApiLoginStrategy(
      cache,
      accountService,
      masterPasswordService,
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
      environmentService,
      keyConnectorService,
      billingAccountProfileStateService,
    );

    credentials = new UserApiLoginCredentials(apiClientId, apiClientSecret);
  });

  it("sends api key credentials to the server", async () => {
    apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());
    await apiLogInStrategy.logIn(credentials);

    expect(apiService.postIdentityToken).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: apiClientId,
        clientSecret: apiClientSecret,
        device: expect.objectContaining({
          identifier: deviceId,
        }),
        twoFactor: expect.objectContaining({
          provider: null,
          token: null,
        }),
      }),
    );
  });

  it("sets the local environment after a successful login", async () => {
    apiService.postIdentityToken.mockResolvedValue(identityTokenResponseFactory());

    const mockVaultTimeoutAction = VaultTimeoutAction.Lock;
    const mockVaultTimeout = 60;
    stateService.getVaultTimeoutAction.mockResolvedValue(mockVaultTimeoutAction);
    stateService.getVaultTimeout.mockResolvedValue(mockVaultTimeout);

    await apiLogInStrategy.logIn(credentials);

    expect(tokenService.setClientId).toHaveBeenCalledWith(
      apiClientId,
      mockVaultTimeoutAction,
      mockVaultTimeout,
    );
    expect(tokenService.setClientSecret).toHaveBeenCalledWith(
      apiClientSecret,
      mockVaultTimeoutAction,
      mockVaultTimeout,
    );
    expect(stateService.addAccount).toHaveBeenCalled();
  });

  it("sets the encrypted user key and private key from the identity token response", async () => {
    const tokenResponse = identityTokenResponseFactory();

    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

    await apiLogInStrategy.logIn(credentials);

    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(tokenResponse.key);
    expect(cryptoService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey);
  });

  it("gets and sets the master key if Key Connector is enabled", async () => {
    const tokenResponse = identityTokenResponseFactory();
    tokenResponse.apiUseKeyConnector = true;

    const env = mock<Environment>();
    env.getKeyConnectorUrl.mockReturnValue(keyConnectorUrl);
    environmentService.environment$ = new BehaviorSubject(env);

    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

    await apiLogInStrategy.logIn(credentials);

    expect(keyConnectorService.setMasterKeyFromUrl).toHaveBeenCalledWith(keyConnectorUrl);
  });

  it("decrypts and sets the user key if Key Connector is enabled", async () => {
    const userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
    const masterKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey;

    const tokenResponse = identityTokenResponseFactory();
    tokenResponse.apiUseKeyConnector = true;

    const env = mock<Environment>();
    env.getKeyConnectorUrl.mockReturnValue(keyConnectorUrl);
    environmentService.environment$ = new BehaviorSubject(env);

    apiService.postIdentityToken.mockResolvedValue(tokenResponse);
    masterPasswordService.masterKeySubject.next(masterKey);
    cryptoService.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

    await apiLogInStrategy.logIn(credentials);

    expect(cryptoService.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(masterKey);
    expect(cryptoService.setUserKey).toHaveBeenCalledWith(userKey);
  });
});
