import { mock, MockProxy } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { AccountCryptographicStateService } from "@bitwarden/common/key-management/account-cryptography/account-cryptographic-state.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { MockSdkService } from "@bitwarden/common/platform/spec/mock-sdk.service";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import {
  EncString as SdkEncString,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";

import { KeyService } from "../../abstractions/key.service";

import { DefaultUserAsymmetricKeysRegenerationService } from "./default-user-asymmetric-key-regeneration.service";

describe("regenerateIfNeeded", () => {
  let sut: DefaultUserAsymmetricKeysRegenerationService;
  const userId = "userId" as UserId;

  let keyService: MockProxy<KeyService>;
  let logService: MockProxy<LogService>;
  let sdkService: MockSdkService;
  let configService: MockProxy<ConfigService>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    logService = mock<LogService>();
    sdkService = new MockSdkService();
    configService = mock<ConfigService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();

    sut = new DefaultUserAsymmetricKeysRegenerationService(
      keyService,
      logService,
      sdkService,
      configService,
      accountCryptographicStateService,
    );

    configService.getFeatureFlag.mockResolvedValue(true);

    const mockRandomBytes = new Uint8Array(64) as CsprngArray;
    const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    keyService.userKey$.mockReturnValue(of(mockUserKey));
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should not call regeneration code when feature flag is off", async () => {
    configService.getFeatureFlag.mockResolvedValue(false);

    await sut.regenerateIfNeeded(userId);

    expect(keyService.userKey$).not.toHaveBeenCalled();
  });

  it("should not regenerate when top level error is thrown", async () => {
    keyService.userKey$.mockReturnValue(throwError(() => new Error("error")));
    const mockClient = sdkService.simulate.userLogin(userId);
    mockClient.user_crypto_management
      .mockDeep()
      .should_regenerate_asymmetric_keys.mockResolvedValue(true);

    await sut.regenerateIfNeeded(userId);

    expect(accountCryptographicStateService.setAccountCryptographicState).not.toHaveBeenCalled();
  });

  it("should not regenerate when user symmetric key is unavailable", async () => {
    keyService.userKey$.mockReturnValue(of(undefined as unknown as UserKey));
    const mockClient = sdkService.simulate.userLogin(userId);
    mockClient.user_crypto_management
      .mockDeep()
      .should_regenerate_asymmetric_keys.mockResolvedValue(true);

    await sut.regenerateIfNeeded(userId);

    expect(accountCryptographicStateService.setAccountCryptographicState).not.toHaveBeenCalled();
  });

  it("should not regenerate when SDK says regeneration is not needed", async () => {
    const mockClient = sdkService.simulate.userLogin(userId);
    mockClient.user_crypto_management
      .mockDeep()
      .should_regenerate_asymmetric_keys.mockResolvedValue(false);

    await sut.regenerateIfNeeded(userId);

    expect(accountCryptographicStateService.setAccountCryptographicState).not.toHaveBeenCalled();
  });

  it("should regenerate when SDK says regeneration is needed", async () => {
    const mockClient = sdkService.simulate.userLogin(userId);
    const mockUserCryptoMgmt = mockClient.user_crypto_management.mockDeep();
    mockUserCryptoMgmt.should_regenerate_asymmetric_keys.mockResolvedValue(true);
    mockUserCryptoMgmt.regenerate_asymmetric_key_pair_if_needed.mockResolvedValue({
      V1: { private_key: "newEncryptedPrivateKey" as SdkEncString },
    } as WrappedAccountCryptographicState);

    await sut.regenerateIfNeeded(userId);

    expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalled();
  });

  it("should not set crypto state when regeneration returns null", async () => {
    const mockClient = sdkService.simulate.userLogin(userId);
    const mockUserCryptoMgmt = mockClient.user_crypto_management.mockDeep();
    mockUserCryptoMgmt.should_regenerate_asymmetric_keys.mockResolvedValue(true);
    mockUserCryptoMgmt.regenerate_asymmetric_key_pair_if_needed.mockResolvedValue(
      undefined as unknown as WrappedAccountCryptographicState,
    );

    await sut.regenerateIfNeeded(userId);

    expect(accountCryptographicStateService.setAccountCryptographicState).not.toHaveBeenCalled();
  });
});

describe("shouldRegenerate", () => {
  let sut: DefaultUserAsymmetricKeysRegenerationService;
  const userId = "userId" as UserId;

  let keyService: MockProxy<KeyService>;
  let logService: MockProxy<LogService>;
  let sdkService: MockSdkService;
  let configService: MockProxy<ConfigService>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    logService = mock<LogService>();
    sdkService = new MockSdkService();
    configService = mock<ConfigService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();

    sut = new DefaultUserAsymmetricKeysRegenerationService(
      keyService,
      logService,
      sdkService,
      configService,
      accountCryptographicStateService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should return false when user key is null", async () => {
    keyService.userKey$.mockReturnValue(of(null as unknown as UserKey));

    const result = await sut.shouldRegenerate(userId);

    expect(result).toBe(false);
  });

  it("should return true when SDK says keys should be regenerated", async () => {
    const mockRandomBytes = new Uint8Array(64) as CsprngArray;
    const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    keyService.userKey$.mockReturnValue(of(mockUserKey));

    const mockClient = sdkService.simulate.userLogin(userId);
    mockClient.user_crypto_management
      .mockDeep()
      .should_regenerate_asymmetric_keys.mockResolvedValue(true);

    const result = await sut.shouldRegenerate(userId);

    expect(result).toBe(true);
  });

  it("should return false when SDK says keys should not be regenerated", async () => {
    const mockRandomBytes = new Uint8Array(64) as CsprngArray;
    const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    keyService.userKey$.mockReturnValue(of(mockUserKey));

    const mockClient = sdkService.simulate.userLogin(userId);
    mockClient.user_crypto_management
      .mockDeep()
      .should_regenerate_asymmetric_keys.mockResolvedValue(false);

    const result = await sut.shouldRegenerate(userId);

    expect(result).toBe(false);
  });
});

describe("regenerateUserPublicKeyEncryptionKeyPair", () => {
  let sut: DefaultUserAsymmetricKeysRegenerationService;
  const userId = "userId" as UserId;

  let keyService: MockProxy<KeyService>;
  let logService: MockProxy<LogService>;
  let sdkService: MockSdkService;
  let configService: MockProxy<ConfigService>;
  let accountCryptographicStateService: MockProxy<AccountCryptographicStateService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    logService = mock<LogService>();
    sdkService = new MockSdkService();
    configService = mock<ConfigService>();
    accountCryptographicStateService = mock<AccountCryptographicStateService>();

    sut = new DefaultUserAsymmetricKeysRegenerationService(
      keyService,
      logService,
      sdkService,
      configService,
      accountCryptographicStateService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should throw error when user key is not found", async () => {
    keyService.userKey$.mockReturnValue(of(null as unknown as UserKey));

    await expect(sut.regenerateUserPublicKeyEncryptionKeyPair(userId)).rejects.toThrow(
      "User key not found",
    );
  });

  it("should set crypto state and return true when SDK returns new state", async () => {
    const mockRandomBytes = new Uint8Array(64) as CsprngArray;
    const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    keyService.userKey$.mockReturnValue(of(mockUserKey));

    const mockCryptoState = {
      V1: { private_key: "newEncryptedPrivateKey" as SdkEncString },
    } as WrappedAccountCryptographicState;
    const mockClient = sdkService.simulate.userLogin(userId);
    mockClient.user_crypto_management
      .mockDeep()
      .regenerate_asymmetric_key_pair_if_needed.mockResolvedValue(mockCryptoState);

    const result = await sut.regenerateUserPublicKeyEncryptionKeyPair(userId);

    expect(result).toBe(true);
    expect(accountCryptographicStateService.setAccountCryptographicState).toHaveBeenCalledWith(
      mockCryptoState,
      userId,
    );
    expect(logService.info).toHaveBeenCalledWith(
      "[UserAsymmetricKeyRegeneration] User's asymmetric keys successfully regenerated.",
    );
  });

  it("should return false when SDK returns null", async () => {
    const mockRandomBytes = new Uint8Array(64) as CsprngArray;
    const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    keyService.userKey$.mockReturnValue(of(mockUserKey));

    const mockClient = sdkService.simulate.userLogin(userId);
    mockClient.user_crypto_management
      .mockDeep()
      .regenerate_asymmetric_key_pair_if_needed.mockResolvedValue(
        undefined as unknown as WrappedAccountCryptographicState,
      );

    const result = await sut.regenerateUserPublicKeyEncryptionKeyPair(userId);

    expect(result).toBe(false);
    expect(accountCryptographicStateService.setAccountCryptographicState).not.toHaveBeenCalled();
  });
});
