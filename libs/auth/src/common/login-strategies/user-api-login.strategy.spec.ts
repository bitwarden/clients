import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { KeyConnectorService } from "@bitwarden/common/key-management/key-connector/abstractions/key-connector.service";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
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
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { UserApiLoginCredentials } from "../models/domain/login-credentials";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { UserApiLoginStrategy, UserApiLoginStrategyData } from "./user-api-login.strategy";

describe("UserApiLoginStrategy", () => {
  let cache: UserApiLoginStrategyData;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  let keyService: MockProxy<KeyService>;
  let encryptService: MockProxy<EncryptService>;
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
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let configService: MockProxy<ConfigService>;

  let apiLogInStrategy: UserApiLoginStrategy;
  let credentials: UserApiLoginCredentials;

  const mockVaultTimeoutAction = VaultTimeoutAction.Lock;
  const mockVaultTimeout = 1000;

  const userId = Utils.newGuid() as UserId;
  const deviceId = Utils.newGuid();
  const keyConnectorUrl = "KEY_CONNECTOR_URL";
  const apiClientId = "API_CLIENT_ID";
  const apiClientSecret = "API_CLIENT_SECRET";

  beforeEach(async () => {
    accountService = mockAccountServiceWith(userId);
    masterPasswordService = new FakeMasterPasswordService();

    keyService = mock<KeyService>();
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
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    kdfConfigService = mock<KdfConfigService>();
    configService = mock<ConfigService>();

    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.getTwoFactorToken.mockResolvedValue(null);
    tokenService.decodeAccessToken.mockResolvedValue({
      sub: userId,
    });

    apiLogInStrategy = new UserApiLoginStrategy(
      cache,
      keyConnectorService,
      accountService,
      masterPasswordService,
      keyService,
      encryptService,
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
      vaultTimeoutSettingsService,
      kdfConfigService,
      environmentService,
      configService,
    );

    credentials = new UserApiLoginCredentials(apiClientId, apiClientSecret);

    const mockVaultTimeoutActionBSub = new BehaviorSubject<VaultTimeoutAction>(
      mockVaultTimeoutAction,
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      mockVaultTimeoutActionBSub.asObservable(),
    );

    const mockVaultTimeoutBSub = new BehaviorSubject<number>(mockVaultTimeout);
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      mockVaultTimeoutBSub.asObservable(),
    );
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

    expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
      tokenResponse.key,
      userId,
    );
    expect(keyService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey, userId);
  });

  it("gets and sets the master key if Key Connector is enabled", async () => {
    const tokenResponse = identityTokenResponseFactory();
    tokenResponse.apiUseKeyConnector = true;

    const env = mock<Environment>();
    env.getKeyConnectorUrl.mockReturnValue(keyConnectorUrl);
    environmentService.environment$ = new BehaviorSubject(env);

    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

    await apiLogInStrategy.logIn(credentials);

    expect(keyConnectorService.setMasterKeyFromUrl).toHaveBeenCalledWith(keyConnectorUrl, userId);
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
    masterPasswordService.mock.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

    await apiLogInStrategy.logIn(credentials);

    expect(masterPasswordService.mock.decryptUserKeyWithMasterKey).toHaveBeenCalledWith(
      masterKey,
      userId,
      undefined,
    );
    expect(keyService.setUserKey).toHaveBeenCalledWith(userKey, userId);
  });
});
