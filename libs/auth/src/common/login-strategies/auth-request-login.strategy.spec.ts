import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { DeviceTrustServiceAbstraction } from "@bitwarden/common/key-management/device-trust/abstractions/device-trust.service.abstraction";
import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { FakeAccountService, mockAccountServiceWith } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";
import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { AuthRequestLoginCredentials } from "../models/domain/login-credentials";

import {
  AuthRequestLoginStrategy,
  AuthRequestLoginStrategyData,
} from "./auth-request-login.strategy";
import { identityTokenResponseFactory } from "./login.strategy.spec";

describe("AuthRequestLoginStrategy", () => {
  let cache: AuthRequestLoginStrategyData;

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
  let userDecryptionOptions: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let deviceTrustService: MockProxy<DeviceTrustServiceAbstraction>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;
  let vaultTimeoutSettingsService: MockProxy<VaultTimeoutSettingsService>;
  let kdfConfigService: MockProxy<KdfConfigService>;
  let environmentService: MockProxy<EnvironmentService>;
  let configService: MockProxy<ConfigService>;

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  let authRequestLoginStrategy: AuthRequestLoginStrategy;
  let credentials: AuthRequestLoginCredentials;
  let tokenResponse: IdentityTokenResponse;

  const deviceId = Utils.newGuid();

  const email = "EMAIL";
  const accessCode = "ACCESS_CODE";
  const authRequestId = "AUTH_REQUEST_ID";
  const decMasterKey = new SymmetricCryptoKey(
    new Uint8Array(64).buffer as CsprngArray,
  ) as MasterKey;
  const decUserKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;
  const decMasterKeyHash = "LOCAL_PASSWORD_HASH";

  beforeEach(async () => {
    keyService = mock<KeyService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    userDecryptionOptions = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    deviceTrustService = mock<DeviceTrustServiceAbstraction>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();
    vaultTimeoutSettingsService = mock<VaultTimeoutSettingsService>();
    kdfConfigService = mock<KdfConfigService>();
    environmentService = mock<EnvironmentService>();
    configService = mock<ConfigService>();

    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();

    tokenService.getTwoFactorToken.mockResolvedValue(null);
    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeAccessToken.mockResolvedValue({
      sub: mockUserId,
    });

    authRequestLoginStrategy = new AuthRequestLoginStrategy(
      cache,
      deviceTrustService,
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
      userDecryptionOptions,
      billingAccountProfileStateService,
      vaultTimeoutSettingsService,
      kdfConfigService,
      environmentService,
      configService,
    );

    tokenResponse = identityTokenResponseFactory();
    apiService.postIdentityToken.mockResolvedValue(tokenResponse);

    const mockVaultTimeoutAction = VaultTimeoutAction.Lock;
    const mockVaultTimeoutActionBSub = new BehaviorSubject<VaultTimeoutAction>(
      mockVaultTimeoutAction,
    );
    vaultTimeoutSettingsService.getVaultTimeoutActionByUserId$.mockReturnValue(
      mockVaultTimeoutActionBSub.asObservable(),
    );

    const mockVaultTimeout = 1000;

    const mockVaultTimeoutBSub = new BehaviorSubject<number>(mockVaultTimeout);
    vaultTimeoutSettingsService.getVaultTimeoutByUserId$.mockReturnValue(
      mockVaultTimeoutBSub.asObservable(),
    );
  });

  it("sets keys after a successful authentication when masterKey and masterKeyHash provided in login credentials", async () => {
    credentials = new AuthRequestLoginCredentials(
      email,
      accessCode,
      authRequestId,
      null,
      decMasterKey,
      decMasterKeyHash,
    );

    const masterKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey;
    const userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;

    masterPasswordService.masterKeySubject.next(masterKey);
    masterPasswordService.mock.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);
    tokenService.decodeAccessToken.mockResolvedValue({ sub: mockUserId });

    await authRequestLoginStrategy.logIn(credentials);

    expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(masterKey, mockUserId);
    expect(masterPasswordService.mock.setMasterKeyHash).toHaveBeenCalledWith(
      decMasterKeyHash,
      mockUserId,
    );
    expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
      tokenResponse.key,
      mockUserId,
    );
    expect(keyService.setUserKey).toHaveBeenCalledWith(userKey, mockUserId);
    expect(deviceTrustService.trustDeviceIfRequired).toHaveBeenCalled();
    expect(keyService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey, mockUserId);
  });

  it("sets keys after a successful authentication when only userKey provided in login credentials", async () => {
    // Initialize credentials with only userKey
    credentials = new AuthRequestLoginCredentials(
      email,
      accessCode,
      authRequestId,
      decUserKey, // Pass userKey
      null, // No masterKey
      null, // No masterKeyHash
    );

    // Call logIn
    await authRequestLoginStrategy.logIn(credentials);

    // setMasterKey and setMasterKeyHash should not be called
    expect(masterPasswordService.mock.setMasterKey).not.toHaveBeenCalled();
    expect(masterPasswordService.mock.setMasterKeyHash).not.toHaveBeenCalled();

    // setMasterKeyEncryptedUserKey, setUserKey, and setPrivateKey should still be called
    expect(masterPasswordService.mock.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
      tokenResponse.key,
      mockUserId,
    );
    expect(keyService.setUserKey).toHaveBeenCalledWith(decUserKey, mockUserId);
    expect(keyService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey, mockUserId);

    // trustDeviceIfRequired should be called
    expect(deviceTrustService.trustDeviceIfRequired).not.toHaveBeenCalled();
  });
});
