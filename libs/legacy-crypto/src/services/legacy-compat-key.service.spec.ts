import { mock } from "jest-mock-extended";
import { BehaviorSubject, of } from "rxjs";

import { FakeMasterPasswordService } from "@bitwarden/common/key-management/master-password/services/fake-master-password.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import {
  makeEncString,
  makeSymmetricCryptoKey,
  FakeAccountService,
  mockAccountServiceWith,
} from "@bitwarden/common/spec";
import { UserId } from "@bitwarden/common/types/guid";
import {
  UserKey,
  MasterKey,
  UserPublicKey,
  OrgKey,
  ProviderKey,
} from "@bitwarden/common/types/key";
import type { KdfConfigService, KeyService } from "@bitwarden/key-management";
import { LogService } from "@bitwarden/logging";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { CryptoFunctionService } from "../abstractions/crypto-function.service";
import { EncryptService } from "../abstractions/encrypt.service";
import { KeyGenerationService } from "../abstractions/key-generation.service";
import { EncString } from "../models/enc-string";
import { KdfConfig } from "../models/kdf-config";
import { SymmetricCryptoKey } from "../models/symmetric-crypto-key";
import { CsprngArray } from "../types/csprng";

import { DefaultLegacyCompatKeyService } from "./legacy-compat-key.service";

describe("legacyCompatKeyService", () => {
  let legacyCompatKeyService: DefaultLegacyCompatKeyService;

  const keyGenerationService = mock<KeyGenerationService>();
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const encryptService = mock<EncryptService>();
  const logService = mock<LogService>();
  const kdfConfigService = mock<KdfConfigService>();
  const keyService = mock<KeyService>();

  const mockUserId = Utils.newGuid() as UserId;
  let accountService: FakeAccountService;
  let masterPasswordService: FakeMasterPasswordService;

  beforeEach(() => {
    accountService = mockAccountServiceWith(mockUserId);
    masterPasswordService = new FakeMasterPasswordService();

    Object.defineProperty(SdkLoadService, "Ready", {
      value: Promise.resolve(),
      configurable: true,
    });

    legacyCompatKeyService = new DefaultLegacyCompatKeyService(
      masterPasswordService,
      keyGenerationService,
      cryptoFunctionService,
      encryptService,
      logService,
      accountService,
      kdfConfigService,
      keyService,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("instantiates", () => {
    expect(legacyCompatKeyService).not.toBeFalsy();
  });

  describe("makeUserKey", () => {
    test.each([null as unknown as MasterKey, undefined as unknown as MasterKey])(
      "throws when the provided masterKey is %s",
      async (masterKey) => {
        await expect(legacyCompatKeyService.makeUserKey(masterKey)).rejects.toThrow(
          "MasterKey is required",
        );
      },
    );

    it("encrypts the user key with the master key", async () => {
      const mockUserKey = makeSymmetricCryptoKey<UserKey>(64);
      const mockEncryptedUserKey = makeEncString("encryptedUserKey");

      jest.spyOn(PureCrypto, "make_aes256_cbc_hmac_key").mockReturnValue({} as any);
      jest.spyOn(SymmetricCryptoKey, "fromSdk").mockReturnValue(mockUserKey);
      encryptService.wrapSymmetricKey.mockResolvedValue(mockEncryptedUserKey);
      const stretchedMasterKey = new SymmetricCryptoKey(new Uint8Array(64));
      keyGenerationService.stretchKey.mockResolvedValue(stretchedMasterKey);

      const result = await legacyCompatKeyService.makeUserKey(
        makeSymmetricCryptoKey<MasterKey>(32),
      );

      expect(encryptService.wrapSymmetricKey).toHaveBeenCalledWith(mockUserKey, stretchedMasterKey);
      expect(PureCrypto.make_aes256_cbc_hmac_key).toHaveBeenCalled();
      expect(result[0]).toBe(mockUserKey);
      expect(result[1]).toBe(mockEncryptedUserKey);
    });
  });

  describe("makeSendKey", () => {
    const mockRandomBytes = new Uint8Array(16) as CsprngArray;
    it("calls keyGenerationService with expected hard coded parameters", async () => {
      await legacyCompatKeyService.makeSendKey(mockRandomBytes);

      expect(keyGenerationService.deriveKeyFromMaterial).toHaveBeenCalledWith(
        mockRandomBytes,
        "bitwarden-send",
        "send",
      );
    });
  });

  describe("getOrDeriveMasterKey", () => {
    beforeEach(() => {
      masterPasswordService.masterKeySubject.next(null);
    });

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(
          legacyCompatKeyService.getOrDeriveMasterKey("password", userId),
        ).rejects.toThrow("User ID is required.");
      },
    );

    it("returns the master key if it is already available", async () => {
      const masterKey = makeSymmetricCryptoKey(32) as MasterKey;
      masterPasswordService.masterKeySubject.next(masterKey);

      const result = await legacyCompatKeyService.getOrDeriveMasterKey("password", mockUserId);

      expect(kdfConfigService.getKdfConfig$).not.toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(masterKey);
    });

    it("throws an error if user's email is not available", async () => {
      accountService.accounts$ = of({});

      await expect(
        legacyCompatKeyService.getOrDeriveMasterKey("password", mockUserId),
      ).rejects.toThrow("No email found for user " + mockUserId);
      expect(kdfConfigService.getKdfConfig$).not.toHaveBeenCalled();
    });

    it("throws an error if no kdf config is found", async () => {
      kdfConfigService.getKdfConfig$.mockReturnValue(of(null));

      await expect(
        legacyCompatKeyService.getOrDeriveMasterKey("password", mockUserId),
      ).rejects.toThrow("No kdf found for user");
    });

    it("derives the master key if it is not available", async () => {
      keyGenerationService.deriveKeyFromPassword.mockReturnValue("mockMasterKey" as any);
      kdfConfigService.getKdfConfig$.mockReturnValue(of("mockKdfConfig" as any));

      const result = await legacyCompatKeyService.getOrDeriveMasterKey("password", mockUserId);

      expect(kdfConfigService.getKdfConfig$).toHaveBeenCalledWith(mockUserId);
      expect(keyGenerationService.deriveKeyFromPassword).toHaveBeenCalledWith(
        "password",
        "email",
        "mockKdfConfig",
      );
      expect(result).toEqual("mockMasterKey");
    });
  });

  describe("makeMasterKey", () => {
    const password = "testPassword";
    let email = "test@example.com";
    const masterKey = makeSymmetricCryptoKey(32) as MasterKey;
    const kdfConfig = mock<KdfConfig>();

    it("derives a master key from password and email", async () => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(masterKey);

      const result = await legacyCompatKeyService.makeMasterKey(password, email, kdfConfig);

      expect(result).toEqual(masterKey);
    });

    it("trims and lowercases the email for key generation call", async () => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(masterKey);
      email = "TEST@EXAMPLE.COM";

      await legacyCompatKeyService.makeMasterKey(password, email, kdfConfig);

      expect(keyGenerationService.deriveKeyFromPassword).toHaveBeenCalledWith(
        password,
        email.trim().toLowerCase(),
        kdfConfig,
      );
    });

    it("should log the time taken to derive the master key", async () => {
      keyGenerationService.deriveKeyFromPassword.mockResolvedValue(masterKey);
      jest.spyOn(Date.prototype, "getTime").mockReturnValueOnce(1000).mockReturnValueOnce(1500);

      await legacyCompatKeyService.makeMasterKey(password, email, kdfConfig);

      expect(logService.info).toHaveBeenCalledWith(
        "[LegacyCompatKeyService] Deriving master key took 500ms",
      );
    });
  });

  describe("hashMasterKey", () => {
    const password = "testPassword";
    const masterKey = makeSymmetricCryptoKey(32) as MasterKey;

    test.each([null as unknown as string, undefined as unknown as string])(
      "throws when the provided password is %s",
      async (password) => {
        await expect(legacyCompatKeyService.hashMasterKey(password, masterKey)).rejects.toThrow(
          "password is required.",
        );
      },
    );

    test.each([null as unknown as MasterKey, undefined as unknown as MasterKey])(
      "throws when the provided key is %s",
      async (key) => {
        await expect(legacyCompatKeyService.hashMasterKey("password", key)).rejects.toThrow(
          "key is required.",
        );
      },
    );

    it("hashes master key with default iterations when no hashPurpose is provided", async () => {
      const mockReturnedHashB64 = "bXlfaGFzaA==";
      cryptoFunctionService.pbkdf2.mockResolvedValue(Utils.fromB64ToArray(mockReturnedHashB64));

      const result = await legacyCompatKeyService.hashMasterKey(password, masterKey);

      expect(cryptoFunctionService.pbkdf2).toHaveBeenCalledWith(
        masterKey.inner().encryptionKey,
        password,
        "sha256",
        1,
      );
      expect(result).toBe(mockReturnedHashB64);
    });
  });

  describe("makeOrgKey", () => {
    const mockUserPublicKey = new Uint8Array(64) as UserPublicKey;
    const shareKey = new SymmetricCryptoKey(new Uint8Array(64));
    const mockEncapsulatedKey = new EncString("mockEncapsulatedKey");

    beforeEach(() => {
      keyService.userPublicKey$.mockReturnValue(new BehaviorSubject(mockUserPublicKey));
      jest.spyOn(PureCrypto, "make_aes256_cbc_hmac_key").mockReturnValue({} as any);
      jest.spyOn(SymmetricCryptoKey, "fromSdk").mockReturnValue(shareKey);
      encryptService.encapsulateKeyUnsigned.mockResolvedValue(mockEncapsulatedKey);
    });

    it("creates a new OrgKey and encapsulates it with the user's public key", async () => {
      const result = await legacyCompatKeyService.makeOrgKey<OrgKey>(mockUserId);

      expect(result).toEqual([mockEncapsulatedKey, shareKey as OrgKey]);
      expect(keyService.userPublicKey$).toHaveBeenCalledWith(mockUserId);
      expect(PureCrypto.make_aes256_cbc_hmac_key).toHaveBeenCalled();
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        shareKey,
        mockUserPublicKey,
      );
    });

    it("creates a new ProviderKey and encapsulates it with the user's public key", async () => {
      const result = await legacyCompatKeyService.makeOrgKey<ProviderKey>(mockUserId);

      expect(result).toEqual([mockEncapsulatedKey, shareKey as ProviderKey]);
      expect(keyService.userPublicKey$).toHaveBeenCalledWith(mockUserId);
      expect(PureCrypto.make_aes256_cbc_hmac_key).toHaveBeenCalled();
      expect(encryptService.encapsulateKeyUnsigned).toHaveBeenCalledWith(
        shareKey,
        mockUserPublicKey,
      );
    });

    test.each([null as unknown as UserId, undefined as unknown as UserId])(
      "throws when the provided userId is %s",
      async (userId) => {
        await expect(legacyCompatKeyService.makeOrgKey(userId)).rejects.toThrow(
          "UserId is required",
        );

        expect(keyService.userPublicKey$).not.toHaveBeenCalled();
        expect(PureCrypto.make_aes256_cbc_hmac_key).not.toHaveBeenCalled();
        expect(encryptService.encapsulateKeyUnsigned).not.toHaveBeenCalled();
      },
    );

    it("throws if the user's public key is not found", async () => {
      keyService.userPublicKey$.mockReturnValue(new BehaviorSubject(null));

      await expect(legacyCompatKeyService.makeOrgKey(mockUserId)).rejects.toThrow(
        "No public key found for user " + mockUserId,
      );

      expect(PureCrypto.make_aes256_cbc_hmac_key).not.toHaveBeenCalled();
      expect(encryptService.encapsulateKeyUnsigned).not.toHaveBeenCalled();
    });
  });

  describe("getFingerprint", () => {
    const mockFingerprintMaterial = "test@example.com";
    const mockPublicKey = new Uint8Array(256);
    const mockKeyFingerprint = Utils.fromB64ToArray("nfG2jTrJilBEsSrg7ffe9exE9PlClem4P2bxlQ6rNbs=");
    const mockUserFingerprint = Utils.fromB64ToArray(
      "V5AQSk83YXd6kZqCncC6d9J72R7UZ60Xl1eIoDoWgTc=",
    );
    const expectedFingerprint = ["predefine", "hunting", "pastime", "enrich", "unhearing"];

    beforeEach(() => {
      cryptoFunctionService.hash.mockResolvedValue(mockKeyFingerprint);
      cryptoFunctionService.hkdfExpand.mockResolvedValue(mockUserFingerprint);
    });

    test.each([null as unknown as Uint8Array, undefined as unknown as Uint8Array])(
      "throws when publicKey is %s",
      async (publicKey) => {
        await expect(
          legacyCompatKeyService.getFingerprint(mockFingerprintMaterial, publicKey),
        ).rejects.toThrow("Public key is required to generate a fingerprint.");
        expect(cryptoFunctionService.hash).not.toHaveBeenCalled();
        expect(cryptoFunctionService.hkdfExpand).not.toHaveBeenCalled();
      },
    );

    it("generates fingerprint successfully", async () => {
      const result = await legacyCompatKeyService.getFingerprint(
        mockFingerprintMaterial,
        mockPublicKey,
      );

      expect(result).toEqual(expectedFingerprint);
      expect(cryptoFunctionService.hash).toHaveBeenCalledWith(mockPublicKey, "sha256");
      expect(cryptoFunctionService.hkdfExpand).toHaveBeenCalledWith(
        mockKeyFingerprint,
        mockFingerprintMaterial,
        32,
        "sha256",
      );
    });

    it("throws when entropy of hash function is too small", async () => {
      const keyFingerprint = new Uint8Array(3);
      cryptoFunctionService.hash.mockResolvedValue(keyFingerprint);
      cryptoFunctionService.hkdfExpand.mockResolvedValue(new Uint8Array(3));

      await expect(
        legacyCompatKeyService.getFingerprint(mockFingerprintMaterial, mockPublicKey),
      ).rejects.toThrow("Output entropy of hash function is too small");

      expect(cryptoFunctionService.hash).toHaveBeenCalledWith(mockPublicKey, "sha256");
      expect(cryptoFunctionService.hkdfExpand).toHaveBeenCalledWith(
        keyFingerprint,
        mockFingerprintMaterial,
        32,
        "sha256",
      );
    });
  });

  describe("encryptUserKeyWithMasterKey", () => {
    const mockMasterKey = makeSymmetricCryptoKey<MasterKey>(32);
    const mockUserKey = makeSymmetricCryptoKey<UserKey>(64);

    test.each([null as unknown as MasterKey, undefined as unknown as MasterKey])(
      "throws when the provided master key is %s",
      async (key) => {
        await expect(
          legacyCompatKeyService.encryptUserKeyWithMasterKey(key, mockUserKey),
        ).rejects.toThrow("masterKey is required.");
      },
    );

    test.each([null as unknown as UserKey, undefined as unknown as UserKey])(
      "throws when the provided userKey key is %s",
      async (key) => {
        await expect(
          legacyCompatKeyService.encryptUserKeyWithMasterKey(mockMasterKey, key),
        ).rejects.toThrow("userKey is required.");
      },
    );

    it("throws with invalid master key size", async () => {
      const invalidMasterKey = new SymmetricCryptoKey(new Uint8Array(78)) as MasterKey;

      await expect(
        legacyCompatKeyService.encryptUserKeyWithMasterKey(invalidMasterKey, mockUserKey),
      ).rejects.toThrow("Invalid key size.");
    });

    it("encrypts the user key with the master key", async () => {
      const mockEncryptedUserKey = makeEncString("encryptedUserKey");

      encryptService.wrapSymmetricKey.mockResolvedValue(mockEncryptedUserKey);
      const stretchedMasterKey = new SymmetricCryptoKey(new Uint8Array(64));
      keyGenerationService.stretchKey.mockResolvedValue(stretchedMasterKey);

      const result = await legacyCompatKeyService.encryptUserKeyWithMasterKey(
        mockMasterKey,
        mockUserKey,
      );

      expect(encryptService.wrapSymmetricKey).toHaveBeenCalledWith(mockUserKey, stretchedMasterKey);
      expect(result[0]).toBe(mockUserKey);
      expect(result[1]).toBe(mockEncryptedUserKey);
    });
  });

  describe("makeKeyPair", () => {
    test.each([null as unknown as SymmetricCryptoKey, undefined as unknown as SymmetricCryptoKey])(
      "throws when the provided key is %s",
      async (key) => {
        await expect(legacyCompatKeyService.makeKeyPair(key)).rejects.toThrow(
          "'key' is a required parameter and must be non-null.",
        );
      },
    );

    it("generates a key pair and returns public key and encrypted private key", async () => {
      const mockKey = new SymmetricCryptoKey(new Uint8Array(64));
      const mockKeyPair: [Uint8Array, Uint8Array] = [new Uint8Array(256), new Uint8Array(256)];
      const mockPublicKeyB64 = "mockPublicKeyB64";
      const mockPrivateKeyEncString = makeEncString("encryptedPrivateKey");

      cryptoFunctionService.rsaGenerateKeyPair.mockResolvedValue(mockKeyPair);
      jest.spyOn(Utils, "fromBufferToB64").mockReturnValue(mockPublicKeyB64);
      encryptService.wrapDecapsulationKey.mockResolvedValue(mockPrivateKeyEncString);

      const [publicKey, privateKey] = await legacyCompatKeyService.makeKeyPair(mockKey);

      expect(cryptoFunctionService.rsaGenerateKeyPair).toHaveBeenCalledWith(2048);
      expect(Utils.fromBufferToB64).toHaveBeenCalledWith(mockKeyPair[0]);
      expect(encryptService.wrapDecapsulationKey).toHaveBeenCalledWith(mockKeyPair[1], mockKey);
      expect(publicKey).toBe(mockPublicKeyB64);
      expect(privateKey).toBe(mockPrivateKeyEncString);
    });
  });
});
