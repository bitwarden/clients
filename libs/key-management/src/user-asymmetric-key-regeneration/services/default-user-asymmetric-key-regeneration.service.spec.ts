import { MockProxy, mock } from "jest-mock-extended";
import { of, throwError } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { EncryptService } from "@bitwarden/common/key-management/crypto/abstractions/encrypt.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { EncryptedString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { ContainerService } from "@bitwarden/common/platform/services/container.service";
import { makeStaticByteArray, mockEnc } from "@bitwarden/common/spec";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { BitwardenClient, VerifyAsymmetricKeysResponse } from "@bitwarden/sdk-internal";

import { KeyService } from "../../abstractions/key.service";
import { UserAsymmetricKeysRegenerationApiService } from "../abstractions/user-asymmetric-key-regeneration-api.service";

import { DefaultUserAsymmetricKeysRegenerationService } from "./default-user-asymmetric-key-regeneration.service";

function setupVerificationResponse(
  mockVerificationResponse: VerifyAsymmetricKeysResponse,
  sdkService: MockProxy<SdkService>,
) {
  const mockKeyPairResponse = {
    userPublicKey: "userPublicKey",
    userKeyEncryptedPrivateKey: "userKeyEncryptedPrivateKey",
  };

  sdkService.client$ = of({
    crypto: () => ({
      verify_asymmetric_keys: jest.fn().mockReturnValue(mockVerificationResponse),
      make_key_pair: jest.fn().mockReturnValue(mockKeyPairResponse),
    }),
    free: jest.fn(),
    echo: jest.fn(),
    version: jest.fn(),
    throw: jest.fn(),
    catch: jest.fn(),
  } as unknown as BitwardenClient);
}

function setupUserKeyValidation(
  cipherService: MockProxy<CipherService>,
  keyService: MockProxy<KeyService>,
  encryptService: MockProxy<EncryptService>,
) {
  const cipher = new Cipher();
  cipher.id = "id";
  cipher.edit = true;
  cipher.viewPassword = true;
  cipher.favorite = false;
  cipher.name = mockEnc("EncryptedString");
  cipher.notes = mockEnc("EncryptedString");
  cipher.key = mockEnc("EncKey");
  cipherService.getAll.mockResolvedValue([cipher]);
  encryptService.decryptToBytes.mockResolvedValue(makeStaticByteArray(64));
  (window as any).bitwardenContainerService = new ContainerService(keyService, encryptService);
}

describe("regenerateIfNeeded", () => {
  let sut: DefaultUserAsymmetricKeysRegenerationService;
  const userId = "userId" as UserId;

  let keyService: MockProxy<KeyService>;
  let cipherService: MockProxy<CipherService>;
  let userAsymmetricKeysRegenerationApiService: MockProxy<UserAsymmetricKeysRegenerationApiService>;
  let logService: MockProxy<LogService>;
  let sdkService: MockProxy<SdkService>;
  let apiService: MockProxy<ApiService>;
  let configService: MockProxy<ConfigService>;
  let encryptService: MockProxy<EncryptService>;

  beforeEach(() => {
    keyService = mock<KeyService>();
    cipherService = mock<CipherService>();
    userAsymmetricKeysRegenerationApiService = mock<UserAsymmetricKeysRegenerationApiService>();
    logService = mock<LogService>();
    sdkService = mock<SdkService>();
    apiService = mock<ApiService>();
    configService = mock<ConfigService>();
    encryptService = mock<EncryptService>();

    sut = new DefaultUserAsymmetricKeysRegenerationService(
      keyService,
      cipherService,
      userAsymmetricKeysRegenerationApiService,
      logService,
      sdkService,
      apiService,
      configService,
    );

    configService.getFeatureFlag.mockResolvedValue(true);

    const mockRandomBytes = new Uint8Array(64) as CsprngArray;
    const mockEncryptedString = new SymmetricCryptoKey(
      mockRandomBytes,
    ).toString() as EncryptedString;
    const mockUserKey = new SymmetricCryptoKey(mockRandomBytes) as UserKey;
    keyService.userKey$.mockReturnValue(of(mockUserKey));
    keyService.userEncryptedPrivateKey$.mockReturnValue(of(mockEncryptedString));
    apiService.getUserPublicKey.mockResolvedValue({
      userId: "userId",
      publicKey: "publicKey",
    } as any);
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
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: true,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    keyService.userKey$.mockReturnValue(throwError(() => new Error("error")));

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should not regenerate when private key is decryptable and valid", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: true,
      validPrivateKey: true,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should not regenerate when user symmetric key is unavailable", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: true,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    keyService.userKey$.mockReturnValue(of(undefined as unknown as UserKey));

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should not regenerate when user's encrypted private key is unavailable", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: true,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    keyService.userEncryptedPrivateKey$.mockReturnValue(
      of(undefined as unknown as EncryptedString),
    );

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should not regenerate when user's public key is unavailable", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: true,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    apiService.getUserPublicKey.mockResolvedValue(undefined as any);

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should regenerate when private key is decryptable and invalid", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: true,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).toHaveBeenCalled();
    expect(keyService.setPrivateKey).toHaveBeenCalled();
  });

  it("should not set private key on known API error", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: true,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);

    userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys.mockRejectedValue(
      new Error("Key regeneration not supported for this user."),
    );

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should not set private key on unknown API error", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: true,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);

    userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys.mockRejectedValue(
      new Error("error"),
    );

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should regenerate when private key is not decryptable and user key is valid", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: false,
      validPrivateKey: true,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    setupUserKeyValidation(cipherService, keyService, encryptService);

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).toHaveBeenCalled();
    expect(keyService.setPrivateKey).toHaveBeenCalled();
  });

  it("should not regenerate when private key is not decryptable and user key is invalid", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: false,
      validPrivateKey: true,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    setupUserKeyValidation(cipherService, keyService, encryptService);
    encryptService.decryptToBytes.mockRejectedValue(new Error("error"));

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should not regenerate when private key is not decryptable and no ciphers to check", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: false,
      validPrivateKey: true,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    cipherService.getAll.mockResolvedValue([]);

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should regenerate when private key is not decryptable and invalid and user key is valid", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: false,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    setupUserKeyValidation(cipherService, keyService, encryptService);

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).toHaveBeenCalled();
    expect(keyService.setPrivateKey).toHaveBeenCalled();
  });

  it("should not regenerate when private key is not decryptable and invalid and user key is invalid", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: false,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    setupUserKeyValidation(cipherService, keyService, encryptService);
    encryptService.decryptToBytes.mockRejectedValue(new Error("error"));

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });

  it("should not regenerate when private key is not decryptable and invalid and no ciphers to check", async () => {
    const mockVerificationResponse: VerifyAsymmetricKeysResponse = {
      privateKeyDecryptable: false,
      validPrivateKey: false,
    };
    setupVerificationResponse(mockVerificationResponse, sdkService);
    cipherService.getAll.mockResolvedValue([]);

    await sut.regenerateIfNeeded(userId);

    expect(
      userAsymmetricKeysRegenerationApiService.regenerateUserAsymmetricKeys,
    ).not.toHaveBeenCalled();
    expect(keyService.setPrivateKey).not.toHaveBeenCalled();
  });
});
