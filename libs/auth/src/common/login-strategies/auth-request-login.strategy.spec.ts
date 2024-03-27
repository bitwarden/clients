import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { DeviceTrustCryptoServiceAbstraction } from "@bitwarden/common/auth/abstractions/device-trust-crypto.service.abstraction";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { TwoFactorService } from "@bitwarden/common/auth/abstractions/two-factor.service";
import { IdentityTokenResponse } from "@bitwarden/common/auth/models/response/identity-token.response";
import { FakeMasterPasswordService } from "@bitwarden/common/auth/services/master-password/fake-master-password.service";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions/account/billing-account-profile-state.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
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

import { InternalUserDecryptionOptionsServiceAbstraction } from "../abstractions/user-decryption-options.service.abstraction";
import { AuthRequestLoginCredentials } from "../models/domain/login-credentials";

import {
  AuthRequestLoginStrategy,
  AuthRequestLoginStrategyData,
} from "./auth-request-login.strategy";
import { identityTokenResponseFactory } from "./login.strategy.spec";

describe("AuthRequestLoginStrategy", () => {
  let cache: AuthRequestLoginStrategyData;

  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let userDecryptionOptions: MockProxy<InternalUserDecryptionOptionsServiceAbstraction>;
  let deviceTrustCryptoService: MockProxy<DeviceTrustCryptoServiceAbstraction>;
  let billingAccountProfileStateService: MockProxy<BillingAccountProfileStateService>;

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
    cryptoService = mock<CryptoService>();
    apiService = mock<ApiService>();
    tokenService = mock<TokenService>();
    appIdService = mock<AppIdService>();
    platformUtilsService = mock<PlatformUtilsService>();
    messagingService = mock<MessagingService>();
    logService = mock<LogService>();
    stateService = mock<StateService>();
    twoFactorService = mock<TwoFactorService>();
    userDecryptionOptions = mock<InternalUserDecryptionOptionsServiceAbstraction>();
    deviceTrustCryptoService = mock<DeviceTrustCryptoServiceAbstraction>();
    billingAccountProfileStateService = mock<BillingAccountProfileStateService>();

    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();

    tokenService.getTwoFactorToken.mockResolvedValue(null);
    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeAccessToken.mockResolvedValue({});

    authRequestLoginStrategy = new AuthRequestLoginStrategy(
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
      userDecryptionOptions,
      deviceTrustCryptoService,
      billingAccountProfileStateService,
    );

    tokenResponse = identityTokenResponseFactory();
    apiService.postIdentityToken.mockResolvedValue(tokenResponse);
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
    cryptoService.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

    await authRequestLoginStrategy.logIn(credentials);

    expect(masterPasswordService.mock.setMasterKey).toHaveBeenCalledWith(masterKey, mockUserId);
    expect(masterPasswordService.mock.setMasterKeyHash).toHaveBeenCalledWith(
      decMasterKeyHash,
      mockUserId,
    );
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(tokenResponse.key);
    expect(cryptoService.setUserKey).toHaveBeenCalledWith(userKey);
    expect(deviceTrustCryptoService.trustDeviceIfRequired).toHaveBeenCalled();
    expect(cryptoService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey);
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
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(tokenResponse.key);
    expect(cryptoService.setUserKey).toHaveBeenCalledWith(decUserKey);
    expect(cryptoService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey);

    // trustDeviceIfRequired should be called
    expect(deviceTrustCryptoService.trustDeviceIfRequired).not.toHaveBeenCalled();
  });
});
