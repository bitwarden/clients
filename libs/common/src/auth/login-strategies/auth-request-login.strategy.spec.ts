import { mock, MockProxy } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { KdfConfigService, KeyService } from "@bitwarden/key-management";

import { FakeAccountService, mockAccountServiceWith } from "../../../spec";
import { ApiService } from "../../abstractions/api.service";
import { BillingAccountProfileStateService } from "../../billing/abstractions";
import { EncryptService } from "../../key-management/crypto/abstractions/encrypt.service";
import { DeviceTrustServiceAbstraction } from "../../key-management/device-trust/abstractions/device-trust.service.abstraction";
import { FakeMasterPasswordService } from "../../key-management/master-password/services/fake-master-password.service";
import {
  VaultTimeoutAction,
  VaultTimeoutSettingsService,
} from "../../key-management/vault-timeout";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { EnvironmentService } from "../../platform/abstractions/environment.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { UserId } from "../../types/guid";
import { MasterKey, UserKey } from "../../types/key";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/two-factor.service";
import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { AuthRequestLoginCredentials } from "../models/domain/login-credentials";
import { IdentityTokenResponse } from "../models/response/identity-token.response";

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
    expect(keyService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
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
    expect(keyService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(
      tokenResponse.key,
      mockUserId,
    );
    expect(keyService.setUserKey).toHaveBeenCalledWith(decUserKey, mockUserId);
    expect(keyService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey, mockUserId);

    // trustDeviceIfRequired should be called
    expect(deviceTrustService.trustDeviceIfRequired).not.toHaveBeenCalled();
  });
});
