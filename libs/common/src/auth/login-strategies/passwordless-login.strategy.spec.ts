import { mock, MockProxy } from "jest-mock-extended";

import { ApiService } from "../../abstractions/api.service";
import { AppIdService } from "../../platform/abstractions/app-id.service";
import { CryptoService } from "../../platform/abstractions/crypto.service";
import { LogService } from "../../platform/abstractions/log.service";
import { MessagingService } from "../../platform/abstractions/messaging.service";
import { PlatformUtilsService } from "../../platform/abstractions/platform-utils.service";
import { StateService } from "../../platform/abstractions/state.service";
import { Utils } from "../../platform/misc/utils";
import {
  MasterKey,
  SymmetricCryptoKey,
  UserKey,
} from "../../platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "../../types/csprng";
import { DeviceTrustCryptoServiceAbstraction } from "../abstractions/device-trust-crypto.service.abstraction";
import { TokenService } from "../abstractions/token.service";
import { TwoFactorService } from "../abstractions/two-factor.service";
import { PasswordlessLogInCredentials } from "../models/domain/log-in-credentials";
import { IdentityTokenResponse } from "../models/response/identity-token.response";

import { identityTokenResponseFactory } from "./login.strategy.spec";
import { PasswordlessLogInStrategy } from "./passwordless-login.strategy";

describe("PasswordlessLogInStrategy", () => {
  let cryptoService: MockProxy<CryptoService>;
  let apiService: MockProxy<ApiService>;
  let tokenService: MockProxy<TokenService>;
  let appIdService: MockProxy<AppIdService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messagingService: MockProxy<MessagingService>;
  let logService: MockProxy<LogService>;
  let stateService: MockProxy<StateService>;
  let twoFactorService: MockProxy<TwoFactorService>;
  let deviceTrustCryptoService: MockProxy<DeviceTrustCryptoServiceAbstraction>;

  let passwordlessLoginStrategy: PasswordlessLogInStrategy;
  let credentials: PasswordlessLogInCredentials;
  let tokenResponse: IdentityTokenResponse;

  const deviceId = Utils.newGuid();

  const email = "EMAIL";
  const accessCode = "ACCESS_CODE";
  const authRequestId = "AUTH_REQUEST_ID";
  const decMasterKey = new SymmetricCryptoKey(
    new Uint8Array(64).buffer as CsprngArray
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
    deviceTrustCryptoService = mock<DeviceTrustCryptoServiceAbstraction>();

    tokenService.getTwoFactorToken.mockResolvedValue(null);
    appIdService.getAppId.mockResolvedValue(deviceId);
    tokenService.decodeToken.mockResolvedValue({});

    passwordlessLoginStrategy = new PasswordlessLogInStrategy(
      cryptoService,
      apiService,
      tokenService,
      appIdService,
      platformUtilsService,
      messagingService,
      logService,
      stateService,
      twoFactorService,
      deviceTrustCryptoService
    );

    tokenResponse = identityTokenResponseFactory();
    apiService.postIdentityToken.mockResolvedValue(tokenResponse);
  });

  it("sets keys after a successful authentication when masterKey and masterKeyHash provided in login credentials", async () => {
    credentials = new PasswordlessLogInCredentials(
      email,
      accessCode,
      authRequestId,
      null,
      decMasterKey,
      decMasterKeyHash
    );

    const masterKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as MasterKey;
    const userKey = new SymmetricCryptoKey(new Uint8Array(64).buffer as CsprngArray) as UserKey;

    cryptoService.getMasterKey.mockResolvedValue(masterKey);
    cryptoService.decryptUserKeyWithMasterKey.mockResolvedValue(userKey);

    await passwordlessLoginStrategy.logIn(credentials);

    expect(cryptoService.setMasterKey).toHaveBeenCalledWith(masterKey);
    expect(cryptoService.setMasterKeyHash).toHaveBeenCalledWith(decMasterKeyHash);
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(tokenResponse.key);
    expect(cryptoService.setUserKey).toHaveBeenCalledWith(userKey);
    expect(deviceTrustCryptoService.trustDeviceIfRequired).toHaveBeenCalled();
    expect(cryptoService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey);
  });

  it("sets keys after a successful authentication when only userKey provided in login credentials", async () => {
    // Initialize credentials with only userKey
    credentials = new PasswordlessLogInCredentials(
      email,
      accessCode,
      authRequestId,
      decUserKey, // Pass userKey
      null, // No masterKey
      null // No masterKeyHash
    );

    // Call logIn
    await passwordlessLoginStrategy.logIn(credentials);

    // setMasterKey and setMasterKeyHash should not be called
    expect(cryptoService.setMasterKey).not.toHaveBeenCalled();
    expect(cryptoService.setMasterKeyHash).not.toHaveBeenCalled();

    // setMasterKeyEncryptedUserKey, setUserKey, and setPrivateKey should still be called
    expect(cryptoService.setMasterKeyEncryptedUserKey).toHaveBeenCalledWith(tokenResponse.key);
    expect(cryptoService.setUserKey).toHaveBeenCalledWith(decUserKey);
    expect(cryptoService.setPrivateKey).toHaveBeenCalledWith(tokenResponse.privateKey);

    // trustDeviceIfRequired should be called
    expect(deviceTrustCryptoService.trustDeviceIfRequired).not.toHaveBeenCalled();
  });
});
