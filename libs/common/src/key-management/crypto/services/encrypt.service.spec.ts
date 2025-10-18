import { mockReset, mock } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { makeStaticByteArray } from "../../../../spec";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";

describe("EncryptService", () => {
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<LogService>();

  let encryptService: EncryptServiceImplementation;

  const testEncBuffer = EncArrayBuffer.fromParts(
    EncryptionType.AesCbc256_HmacSha256_B64,
    new Uint8Array(16),
    new Uint8Array(32),
    new Uint8Array(32),
  );

  beforeEach(() => {
    mockReset(cryptoFunctionService);
    mockReset(logService);

    jest.spyOn(PureCrypto, "symmetric_decrypt_array_buffer").mockReturnValue(new Uint8Array(1));
    jest.spyOn(PureCrypto, "symmetric_decrypt").mockReturnValue("decrypted_string");

    jest.spyOn(PureCrypto, "symmetric_decrypt_filedata").mockReturnValue(new Uint8Array(1));
    jest.spyOn(PureCrypto, "symmetric_encrypt_filedata").mockReturnValue(testEncBuffer.buffer);
    jest.spyOn(PureCrypto, "symmetric_decrypt_string").mockReturnValue("decrypted_string");
    jest.spyOn(PureCrypto, "symmetric_encrypt_string").mockReturnValue("encrypted_string");
    jest.spyOn(PureCrypto, "symmetric_decrypt_bytes").mockReturnValue(new Uint8Array(3));
    jest.spyOn(PureCrypto, "symmetric_encrypt_bytes").mockReturnValue("encrypted_bytes");

    jest.spyOn(PureCrypto, "wrap_decapsulation_key").mockReturnValue("wrapped_decapsulation_key");
    jest.spyOn(PureCrypto, "wrap_encapsulation_key").mockReturnValue("wrapped_encapsulation_key");
    jest.spyOn(PureCrypto, "wrap_symmetric_key").mockReturnValue("wrapped_symmetric_key");
    jest.spyOn(PureCrypto, "unwrap_decapsulation_key").mockReturnValue(new Uint8Array(4));
    jest.spyOn(PureCrypto, "unwrap_encapsulation_key").mockReturnValue(new Uint8Array(5));
    jest.spyOn(PureCrypto, "unwrap_symmetric_key").mockReturnValue(new Uint8Array(64));

    jest.spyOn(PureCrypto, "decapsulate_key_unsigned").mockReturnValue(new Uint8Array(64));
    jest.spyOn(PureCrypto, "encapsulate_key_unsigned").mockReturnValue("encapsulated_key_unsigned");
    (SdkLoadService as any).Ready = jest.fn().mockResolvedValue(true);

    encryptService = new EncryptServiceImplementation(cryptoFunctionService, logService, true);
  });

  describe("wrapSymmetricKey", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      await encryptService.wrapSymmetricKey(key, wrappingKey);
      expect(PureCrypto.wrap_symmetric_key).toHaveBeenCalledWith(
        key.toEncoded(),
        wrappingKey.toEncoded(),
      );
    });
    it("fails if key toBeWrapped is null", async () => {
      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      await expect(encryptService.wrapSymmetricKey(null, wrappingKey)).rejects.toThrow(
        "No keyToBeWrapped provided for wrapping.",
      );
    });
    it("fails if wrapping key is null", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      await expect(encryptService.wrapSymmetricKey(key, null)).rejects.toThrow(
        "No wrappingKey provided for wrapping.",
      );
    });
  });

  describe("wrapDecapsulationKey", () => {
    it("is a proxy to PureCrypto", async () => {
      const decapsulationKey = makeStaticByteArray(10);
      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      await encryptService.wrapDecapsulationKey(decapsulationKey, wrappingKey);
      expect(PureCrypto.wrap_decapsulation_key).toHaveBeenCalledWith(
        decapsulationKey,
        wrappingKey.toEncoded(),
      );
    });
    it("fails if decapsulation key is null", async () => {
      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      await expect(encryptService.wrapDecapsulationKey(null, wrappingKey)).rejects.toThrow(
        "No decapsulation key provided for wrapping.",
      );
    });
    it("fails if wrapping key is null", async () => {
      const decapsulationKey = makeStaticByteArray(64);
      await expect(encryptService.wrapDecapsulationKey(decapsulationKey, null)).rejects.toThrow(
        "No wrappingKey provided for wrapping.",
      );
    });
  });

  describe("wrapEncapsulationKey", () => {
    it("is a proxy to PureCrypto", async () => {
      const encapsulationKey = makeStaticByteArray(10);
      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      await encryptService.wrapEncapsulationKey(encapsulationKey, wrappingKey);
      expect(PureCrypto.wrap_encapsulation_key).toHaveBeenCalledWith(
        encapsulationKey,
        wrappingKey.toEncoded(),
      );
    });
    it("fails if encapsulation key is null", async () => {
      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      await expect(encryptService.wrapEncapsulationKey(null, wrappingKey)).rejects.toThrow(
        "No encapsulation key provided for wrapping.",
      );
    });
    it("fails if wrapping key is null", async () => {
      const encapsulationKey = makeStaticByteArray(64);
      await expect(encryptService.wrapEncapsulationKey(encapsulationKey, null)).rejects.toThrow(
        "No wrappingKey provided for wrapping.",
      );
    });
  });

  describe("encryptString", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const plainValue = "data";
      const result = await encryptService.encryptString(plainValue, key);
      expect(result).toEqual(new EncString("encrypted_string"));
      expect(PureCrypto.symmetric_encrypt_string).toHaveBeenCalledWith(plainValue, key.toEncoded());
    });
  });

  describe("encryptBytes", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const plainValue = makeStaticByteArray(16, 1);
      const result = await encryptService.encryptBytes(plainValue, key);
      expect(result).toEqual(new EncString("encrypted_bytes"));
      expect(PureCrypto.symmetric_encrypt_bytes).toHaveBeenCalledWith(plainValue, key.toEncoded());
    });
  });

  describe("encryptFileData", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const plainValue = makeStaticByteArray(16, 1);
      const result = await encryptService.encryptFileData(plainValue, key);
      expect(result).toEqual(testEncBuffer);
      expect(PureCrypto.symmetric_encrypt_filedata).toHaveBeenCalledWith(
        plainValue,
        key.toEncoded(),
      );
    });
  });

  describe("decryptString", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString("encrypted_string");
      const result = await encryptService.decryptString(encString, key);
      expect(result).toEqual("decrypted_string");
      expect(PureCrypto.symmetric_decrypt_string).toHaveBeenCalledWith(
        encString.encryptedString,
        key.toEncoded(),
      );
    });

    it("throws if disableType0Decryption is enabled and type is AesCbc256_B64", async () => {
      encryptService.setDisableType0Decryption(true);
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "encrypted_string");
      await expect(encryptService.decryptString(encString, key)).rejects.toThrow(
        "Decryption of AesCbc256_B64 encrypted data is disabled.",
      );
    });
  });

  describe("decryptBytes", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString("encrypted_bytes");
      const result = await encryptService.decryptBytes(encString, key);
      expect(result).toEqual(new Uint8Array(3));
      expect(PureCrypto.symmetric_decrypt_bytes).toHaveBeenCalledWith(
        encString.encryptedString,
        key.toEncoded(),
      );
    });

    it("throws if disableType0Decryption is enabled and type is AesCbc256_B64", async () => {
      encryptService.setDisableType0Decryption(true);
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "encrypted_bytes");
      await expect(encryptService.decryptBytes(encString, key)).rejects.toThrow(
        "Decryption of AesCbc256_B64 encrypted data is disabled.",
      );
    });
  });

  describe("decryptFileData", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncArrayBuffer(testEncBuffer.buffer);
      const result = await encryptService.decryptFileData(encString, key);
      expect(result).toEqual(new Uint8Array(1));
      expect(PureCrypto.symmetric_decrypt_filedata).toHaveBeenCalledWith(
        encString.buffer,
        key.toEncoded(),
      );
    });

    it("throws if disableType0Decryption is enabled and type is AesCbc256_B64", async () => {
      encryptService.setDisableType0Decryption(true);
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encBuffer = EncArrayBuffer.fromParts(
        EncryptionType.AesCbc256_B64,
        new Uint8Array(16),
        new Uint8Array(32),
        null,
      );
      await expect(encryptService.decryptFileData(encBuffer, key)).rejects.toThrow(
        "Decryption of AesCbc256_B64 encrypted data is disabled.",
      );
    });
  });

  describe("unwrapDecapsulationKey", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString("wrapped_decapsulation_key");
      const result = await encryptService.unwrapDecapsulationKey(encString, key);
      expect(result).toEqual(new Uint8Array(4));
      expect(PureCrypto.unwrap_decapsulation_key).toHaveBeenCalledWith(
        encString.encryptedString,
        key.toEncoded(),
      );
    });
    it("throws if disableType0Decryption is enabled and type is AesCbc256_B64", async () => {
      encryptService.setDisableType0Decryption(true);
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "wrapped_decapsulation_key");
      await expect(encryptService.unwrapDecapsulationKey(encString, key)).rejects.toThrow(
        "Decryption of AesCbc256_B64 encrypted data is disabled.",
      );
    });
    it("throws if wrappedDecapsulationKey is null", () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      return expect(encryptService.unwrapDecapsulationKey(null, key)).rejects.toThrow(
        "No wrappedDecapsulationKey provided for unwrapping.",
      );
    });
    it("throws if wrappingKey is null", () => {
      const encString = new EncString("wrapped_decapsulation_key");
      return expect(encryptService.unwrapDecapsulationKey(encString, null)).rejects.toThrow(
        "No wrappingKey provided for unwrapping.",
      );
    });
  });

  describe("unwrapEncapsulationKey", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString("wrapped_encapsulation_key");
      const result = await encryptService.unwrapEncapsulationKey(encString, key);
      expect(result).toEqual(new Uint8Array(5));
      expect(PureCrypto.unwrap_encapsulation_key).toHaveBeenCalledWith(
        encString.encryptedString,
        key.toEncoded(),
      );
    });
    it("throws if disableType0Decryption is enabled and type is AesCbc256_B64", async () => {
      encryptService.setDisableType0Decryption(true);
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "wrapped_encapsulation_key");
      await expect(encryptService.unwrapEncapsulationKey(encString, key)).rejects.toThrow(
        "Decryption of AesCbc256_B64 encrypted data is disabled.",
      );
    });
    it("throws if wrappedEncapsulationKey is null", () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      return expect(encryptService.unwrapEncapsulationKey(null, key)).rejects.toThrow(
        "No wrappedEncapsulationKey provided for unwrapping.",
      );
    });
    it("throws if wrappingKey is null", () => {
      const encString = new EncString("wrapped_encapsulation_key");
      return expect(encryptService.unwrapEncapsulationKey(encString, null)).rejects.toThrow(
        "No wrappingKey provided for unwrapping.",
      );
    });
  });

  describe("unwrapSymmetricKey", () => {
    it("is a proxy to PureCrypto", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString("wrapped_symmetric_key");
      const result = await encryptService.unwrapSymmetricKey(encString, key);
      expect(result).toEqual(new SymmetricCryptoKey(new Uint8Array(64)));
      expect(PureCrypto.unwrap_symmetric_key).toHaveBeenCalledWith(
        encString.encryptedString,
        key.toEncoded(),
      );
    });
    it("throws if disableType0Decryption is enabled and type is AesCbc256_B64", async () => {
      encryptService.setDisableType0Decryption(true);
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "wrapped_symmetric_key");
      await expect(encryptService.unwrapSymmetricKey(encString, key)).rejects.toThrow(
        "Decryption of AesCbc256_B64 encrypted data is disabled.",
      );
    });
    it("throws if keyToBeUnwrapped is null", () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      return expect(encryptService.unwrapSymmetricKey(null, key)).rejects.toThrow(
        "No keyToBeUnwrapped provided for unwrapping.",
      );
    });
    it("throws if wrappingKey is null", () => {
      const encString = new EncString("wrapped_symmetric_key");
      return expect(encryptService.unwrapSymmetricKey(encString, null)).rejects.toThrow(
        "No wrappingKey provided for unwrapping.",
      );
    });
  });

  describe("rsa", () => {
    const data = makeStaticByteArray(64, 100);
    const testKey = new SymmetricCryptoKey(data);
    const encryptedData = makeStaticByteArray(10, 150);
    const publicKey = makeStaticByteArray(10, 200);
    const privateKey = makeStaticByteArray(10, 250);
    const encString = makeEncString(encryptedData);

    function makeEncString(data: Uint8Array): EncString {
      return new EncString(EncryptionType.Rsa2048_OaepSha1_B64, Utils.fromBufferToB64(data));
    }

    describe("encapsulateKeyUnsigned", () => {
      it("throws if no data is provided", () => {
        return expect(encryptService.encapsulateKeyUnsigned(null, publicKey)).rejects.toThrow(
          "No sharedKey provided for encapsulation",
        );
      });

      it("throws if no public key is provided", () => {
        return expect(encryptService.encapsulateKeyUnsigned(testKey, null)).rejects.toThrow(
          "No encapsulationKey provided for encapsulation",
        );
      });

      it("encrypts data with provided key", async () => {
        const actual = await encryptService.encapsulateKeyUnsigned(testKey, publicKey);
        expect(actual).toEqual(new EncString("encapsulated_key_unsigned"));
      });
    });

    describe("decapsulateKeyUnsigned", () => {
      it("throws if no data is provided", () => {
        return expect(encryptService.decapsulateKeyUnsigned(null, privateKey)).rejects.toThrow(
          "No encryptedSharedKey provided for decapsulation",
        );
      });

      it("throws if no private key is provided", () => {
        return expect(encryptService.decapsulateKeyUnsigned(encString, null)).rejects.toThrow(
          "No decapsulationKey provided for decapsulation",
        );
      });

      it("decrypts data with provided key", async () => {
        const actual = await encryptService.decapsulateKeyUnsigned(makeEncString(data), privateKey);
        expect(actual.toEncoded()).toEqualBuffer(new Uint8Array(64));
      });
    });
  });

  describe("hash", () => {
    it("hashes a string and returns b64", async () => {
      cryptoFunctionService.hash.mockResolvedValue(Uint8Array.from([1, 2, 3]));
      expect(await encryptService.hash("test", "sha256")).toEqual("AQID");
      expect(cryptoFunctionService.hash).toHaveBeenCalledWith("test", "sha256");
    });
  });
});
