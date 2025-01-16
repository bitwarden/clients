import { mock } from "jest-mock-extended";

import { PBKDF2KdfConfig, Argon2KdfConfig } from "@bitwarden/key-management";

import { CsprngArray } from "../../types/csprng";
import { CryptoFunctionService } from "../abstractions/crypto-function.service";

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
        expect(derivedKey.key.length).toEqual(64);
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

      expect(key.key.length).toEqual(64);
    });
  });

  describe("deriveKeyFromPassword", () => {
    it("should derive a 32 byte key from a password using pbkdf2", async () => {
      const password = "password";
      const salt = "salt";
      const kdfConfig = new PBKDF2KdfConfig(600_000);

      cryptoFunctionService.pbkdf2.mockResolvedValue(new Uint8Array(32));

      const key = await sut.deriveKeyFromPassword(password, salt, kdfConfig);

      expect(key.key.length).toEqual(32);
    });

    it("should derive a 32 byte key from a password using argon2id", async () => {
      const password = "password";
      const salt = "salt";
      const kdfConfig = new Argon2KdfConfig(3, 16, 4);

      cryptoFunctionService.hash.mockResolvedValue(new Uint8Array(32));
      cryptoFunctionService.argon2.mockResolvedValue(new Uint8Array(32));

      const key = await sut.deriveKeyFromPassword(password, salt, kdfConfig);

      expect(key.key.length).toEqual(32);
    });
  });
});
