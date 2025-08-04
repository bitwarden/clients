import { mock } from "jest-mock-extended";

// This import has been flagged as unallowed for this class. It may be involved in a circular dependency loop.
// eslint-disable-next-line no-restricted-imports
import { PBKDF2KdfConfig, Argon2KdfConfig } from "@bitwarden/key-management";

import { CryptoFunctionService } from "../../key-management/crypto/abstractions/crypto-function.service";
import { CsprngArray } from "../../types/csprng";
import { SdkLoadService } from "../abstractions/sdk/sdk-load.service";
import { EncryptionType } from "../enums";
import { SymmetricCryptoKey } from "../models/domain/symmetric-crypto-key";

import { KeyGenerationService } from "./key-generation.service";

describe("KeyGenerationService", () => {
  let sut: KeyGenerationService;

  const cryptoFunctionService = mock<CryptoFunctionService>();

  beforeEach(() => {
    sut = new KeyGenerationService(cryptoFunctionService);
  });

  describe("createKey", () => {
    test.each([256, 512])(
      "it should delegate key creation to crypto function service",
      async (bitLength: 256 | 512) => {
        cryptoFunctionService.aesGenerateKey
          .calledWith(bitLength)
          .mockResolvedValue(new Uint8Array(bitLength / 8) as CsprngArray);

        await sut.createKey(bitLength);

        expect(cryptoFunctionService.aesGenerateKey).toHaveBeenCalledWith(bitLength);
      },
    );
  });

  describe("createMaterialAndKey", () => {
    test.each([128, 192, 256, 512])(
      "should create a 64 byte key from different material lengths",
      async (bitLength: 128 | 192 | 256 | 512) => {
        const inputMaterial = new Uint8Array(bitLength / 8) as CsprngArray;
        const inputSalt = "salt";
        const purpose = "purpose";

        cryptoFunctionService.aesGenerateKey.calledWith(bitLength).mockResolvedValue(inputMaterial);
        cryptoFunctionService.hkdf
          .calledWith(inputMaterial, inputSalt, purpose, 64, "sha256")
          .mockResolvedValue(new Uint8Array(64));

        const { salt, material, derivedKey } = await sut.createKeyWithPurpose(
          bitLength,
          purpose,
          inputSalt,
        );

        expect(salt).toEqual(inputSalt);
        expect(material).toEqual(inputMaterial);
        expect(derivedKey.inner().type).toEqual(EncryptionType.AesCbc256_HmacSha256_B64);
      },
    );
  });

  describe("deriveKeyFromMaterial", () => {
    it("should derive a 64 byte key from material", async () => {
      const material = new Uint8Array(32) as CsprngArray;
      const salt = "salt";
      const purpose = "purpose";

      cryptoFunctionService.hkdf.mockResolvedValue(new Uint8Array(64));

      const key = await sut.deriveKeyFromMaterial(material, salt, purpose);

      expect(key.inner().type).toEqual(EncryptionType.AesCbc256_HmacSha256_B64);
    });
  });

  describe("deriveKeyFromPassword", () => {
    it("should derive a 32 byte key from a password using pbkdf2", async () => {
      const password = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const salt = new Uint8Array([9, 10, 11, 12]);
      const kdfConfig = new PBKDF2KdfConfig(600_000);

      Object.defineProperty(SdkLoadService, "Ready", {
        value: Promise.resolve(),
        configurable: true,
      });

      const key = await sut.deriveKeyFromPassword(password, salt, kdfConfig);
      expect(key.inner().type).toEqual(EncryptionType.AesCbc256_B64);
    });

    it("should derive a 32 byte key from a password using argon2id", async () => {
      const password = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      const salt = new Uint8Array([9, 10, 11, 12]);
      const kdfConfig = new Argon2KdfConfig(3, 16, 4);

      Object.defineProperty(SdkLoadService, "Ready", {
        value: Promise.resolve(),
        configurable: true,
      });

      const key = await sut.deriveKeyFromPassword(password, salt, kdfConfig);
      expect(key.inner().type).toEqual(EncryptionType.AesCbc256_B64);
    });
  });

  describe("stretchKey", () => {
    it("should stretch a key", async () => {
      const key = new SymmetricCryptoKey(new Uint8Array(32));

      cryptoFunctionService.hkdf.mockResolvedValue(new Uint8Array(64));

      const stretchedKey = await sut.stretchKey(key);

      expect(stretchedKey.inner().type).toEqual(EncryptionType.AesCbc256_HmacSha256_B64);
    });
    it("should throw if key is not 32 bytes", async () => {
      const key = new SymmetricCryptoKey(new Uint8Array(64));

      await expect(sut.stretchKey(key)).rejects.toThrow(
        "Key passed into stretchKey is not a 256-bit key.",
      );
    });
  });
});
