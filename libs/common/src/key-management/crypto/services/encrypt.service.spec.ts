import { mockReset, mock } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";

import { makeStaticByteArray } from "../../../../spec";

import { EncryptServiceImplementation } from "./encrypt.service.implementation";

describe("EncryptService", () => {
  const cryptoFunctionService = mock<CryptoFunctionService>();
  const logService = mock<LogService>();

  let encryptService: EncryptServiceImplementation;

  beforeEach(() => {
    mockReset(cryptoFunctionService);
    mockReset(logService);

    encryptService = new EncryptServiceImplementation(cryptoFunctionService, logService, true);
  });

  describe("encrypt", () => {
    it("throws if no key is provided", () => {
      return expect(encryptService.encrypt(null, null)).rejects.toThrow(
        "No encryption key provided.",
      );
    });
    it("returns null if no data is provided", async () => {
      const key = mock<SymmetricCryptoKey>();
      const actual = await encryptService.encrypt(null, key);
      expect(actual).toBeNull();
    });
    it("creates an EncString for Aes256Cbc", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32));
      const plainValue = "data";
      cryptoFunctionService.aesEncrypt.mockResolvedValue(makeStaticByteArray(4, 100));
      cryptoFunctionService.randomBytes.mockResolvedValue(makeStaticByteArray(16) as CsprngArray);
      const result = await encryptService.encrypt(plainValue, key);
      expect(cryptoFunctionService.aesEncrypt).toHaveBeenCalledWith(
        Utils.fromByteStringToArray(plainValue),
        makeStaticByteArray(16),
        makeStaticByteArray(32),
      );
      expect(cryptoFunctionService.hmac).not.toHaveBeenCalled();

      expect(Utils.fromB64ToArray(result.data).length).toEqual(4);
      expect(Utils.fromB64ToArray(result.iv).length).toEqual(16);
    });
    it("creates an EncString for Aes256Cbc_HmacSha256_B64", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const plainValue = "data";
      cryptoFunctionService.hmac.mockResolvedValue(makeStaticByteArray(32));
      cryptoFunctionService.aesEncrypt.mockResolvedValue(makeStaticByteArray(4, 100));
      cryptoFunctionService.randomBytes.mockResolvedValue(makeStaticByteArray(16) as CsprngArray);
      const result = await encryptService.encrypt(plainValue, key);
      expect(cryptoFunctionService.aesEncrypt).toHaveBeenCalledWith(
        Utils.fromByteStringToArray(plainValue),
        makeStaticByteArray(16),
        makeStaticByteArray(32),
      );

      const macData = new Uint8Array(16 + 4);
      macData.set(makeStaticByteArray(16));
      macData.set(makeStaticByteArray(4, 100), 16);
      expect(cryptoFunctionService.hmac).toHaveBeenCalledWith(
        macData,
        makeStaticByteArray(32, 32),
        "sha256",
      );

      expect(Utils.fromB64ToArray(result.data).length).toEqual(4);
      expect(Utils.fromB64ToArray(result.iv).length).toEqual(16);
      expect(Utils.fromB64ToArray(result.mac).length).toEqual(32);
    });
  });

  describe("encryptToBytes", () => {
    const plainValue = makeStaticByteArray(16, 1);

    it("throws if no key is provided", () => {
      return expect(encryptService.encryptToBytes(plainValue, null)).rejects.toThrow(
        "No encryption key",
      );
    });

    it("encrypts data with provided Aes256Cbc key and returns correct encbuffer", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32, 0));
      const iv = makeStaticByteArray(16, 80);
      const cipherText = makeStaticByteArray(20, 150);
      cryptoFunctionService.randomBytes.mockResolvedValue(iv as CsprngArray);
      cryptoFunctionService.aesEncrypt.mockResolvedValue(cipherText);

      const actual = await encryptService.encryptToBytes(plainValue, key);
      const expectedBytes = new Uint8Array(1 + iv.byteLength + cipherText.byteLength);
      expectedBytes.set([EncryptionType.AesCbc256_B64]);
      expectedBytes.set(iv, 1);
      expectedBytes.set(cipherText, 1 + iv.byteLength);

      expect(actual.buffer).toEqualBuffer(expectedBytes);
    });

    it("encrypts data with provided Aes256Cbc_HmacSha256 key and returns correct encbuffer", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64, 0));
      const iv = makeStaticByteArray(16, 80);
      const mac = makeStaticByteArray(32, 100);
      const cipherText = makeStaticByteArray(20, 150);
      cryptoFunctionService.randomBytes.mockResolvedValue(iv as CsprngArray);
      cryptoFunctionService.aesEncrypt.mockResolvedValue(cipherText);
      cryptoFunctionService.hmac.mockResolvedValue(mac);

      const actual = await encryptService.encryptToBytes(plainValue, key);
      const expectedBytes = new Uint8Array(
        1 + iv.byteLength + mac.byteLength + cipherText.byteLength,
      );
      expectedBytes.set([EncryptionType.AesCbc256_HmacSha256_B64]);
      expectedBytes.set(iv, 1);
      expectedBytes.set(mac, 1 + iv.byteLength);
      expectedBytes.set(cipherText, 1 + iv.byteLength + mac.byteLength);

      expect(actual.buffer).toEqualBuffer(expectedBytes);
    });
  });

  describe("decryptToBytes", () => {
    const encType = EncryptionType.AesCbc256_HmacSha256_B64;
    const key = new SymmetricCryptoKey(makeStaticByteArray(64, 100));
    const computedMac = new Uint8Array(1);
    const encBuffer = new EncArrayBuffer(makeStaticByteArray(60, encType));

    beforeEach(() => {
      cryptoFunctionService.hmac.mockResolvedValue(computedMac);
    });

    it("throws if no key is provided", () => {
      return expect(encryptService.decryptToBytes(encBuffer, null)).rejects.toThrow(
        "No encryption key",
      );
    });

    it("throws if no encrypted value is provided", () => {
      return expect(encryptService.decryptToBytes(null, key)).rejects.toThrow(
        "Nothing provided for decryption",
      );
    });

    it("decrypts data with provided key for Aes256Cbc", async () => {
      const decryptedBytes = makeStaticByteArray(10, 200);

      cryptoFunctionService.hmac.mockResolvedValue(makeStaticByteArray(1));
      cryptoFunctionService.compare.mockResolvedValue(true);
      cryptoFunctionService.aesDecrypt.mockResolvedValueOnce(decryptedBytes);

      const actual = await encryptService.decryptToBytes(encBuffer, key);

      expect(cryptoFunctionService.aesDecrypt).toBeCalledWith(
        expect.toEqualBuffer(encBuffer.dataBytes),
        expect.toEqualBuffer(encBuffer.ivBytes),
        expect.toEqualBuffer(key.encKey),
        "cbc",
      );

      expect(actual).toEqualBuffer(decryptedBytes);
    });

    it("decrypts data with provided key for Aes256Cbc", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32, 0));
      const encBuffer = new EncArrayBuffer(makeStaticByteArray(60, EncryptionType.AesCbc256_B64));
      const decryptedBytes = makeStaticByteArray(10, 200);

      cryptoFunctionService.hmac.mockResolvedValue(makeStaticByteArray(1));
      cryptoFunctionService.compare.mockResolvedValue(true);
      cryptoFunctionService.aesDecrypt.mockResolvedValueOnce(decryptedBytes);

      const actual = await encryptService.decryptToBytes(encBuffer, key);

      expect(cryptoFunctionService.aesDecrypt).toBeCalledWith(
        expect.toEqualBuffer(encBuffer.dataBytes),
        expect.toEqualBuffer(encBuffer.ivBytes),
        expect.toEqualBuffer(key.encKey),
        "cbc",
      );

      expect(actual).toEqualBuffer(decryptedBytes);
    });

    it("compares macs using CryptoFunctionService", async () => {
      const expectedMacData = new Uint8Array(
        encBuffer.ivBytes.byteLength + encBuffer.dataBytes.byteLength,
      );
      expectedMacData.set(new Uint8Array(encBuffer.ivBytes));
      expectedMacData.set(new Uint8Array(encBuffer.dataBytes), encBuffer.ivBytes.byteLength);

      await encryptService.decryptToBytes(encBuffer, key);

      expect(cryptoFunctionService.hmac).toBeCalledWith(
        expect.toEqualBuffer(expectedMacData),
        key.macKey,
        "sha256",
      );

      expect(cryptoFunctionService.compare).toBeCalledWith(
        expect.toEqualBuffer(encBuffer.macBytes),
        expect.toEqualBuffer(computedMac),
      );
    });

    it("returns null if macs don't match", async () => {
      cryptoFunctionService.compare.mockResolvedValue(false);

      const actual = await encryptService.decryptToBytes(encBuffer, key);
      expect(cryptoFunctionService.compare).toHaveBeenCalled();
      expect(cryptoFunctionService.aesDecrypt).not.toHaveBeenCalled();
      expect(actual).toBeNull();
    });

    it("returns null if mac could not be calculated", async () => {
      cryptoFunctionService.hmac.mockResolvedValue(null);

      const actual = await encryptService.decryptToBytes(encBuffer, key);
      expect(cryptoFunctionService.hmac).toHaveBeenCalled();
      expect(cryptoFunctionService.aesDecrypt).not.toHaveBeenCalled();
      expect(actual).toBeNull();
    });

    it("returns null if key is Aes256Cbc but encbuffer is Aes256Cbc_HmacSha256", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32, 0));
      cryptoFunctionService.compare.mockResolvedValue(true);

      const actual = await encryptService.decryptToBytes(encBuffer, key);

      expect(actual).toBeNull();
      expect(cryptoFunctionService.aesDecrypt).not.toHaveBeenCalled();
    });

    it("returns null if key is Aes256Cbc_HmacSha256 but encbuffer is Aes256Cbc", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64, 0));
      cryptoFunctionService.compare.mockResolvedValue(true);
      const buffer = new EncArrayBuffer(makeStaticByteArray(200, EncryptionType.AesCbc256_B64));
      const actual = await encryptService.decryptToBytes(buffer, key);

      expect(actual).toBeNull();
      expect(cryptoFunctionService.aesDecrypt).not.toHaveBeenCalled();
    });
  });

  describe("decryptToUtf8", () => {
    it("throws if no key is provided", () => {
      return expect(encryptService.decryptToUtf8(null, null)).rejects.toThrow(
        "No key provided for decryption.",
      );
    });

    it("decrypts data with provided key for Aes256Cbc_HmacSha256", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64, 0));
      const encString = new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "data", "iv", "mac");
      cryptoFunctionService.aesDecryptFastParameters.mockReturnValue({
        macData: makeStaticByteArray(32, 0),
        macKey: makeStaticByteArray(32, 0),
        mac: makeStaticByteArray(32, 0),
      } as any);
      cryptoFunctionService.hmacFast.mockResolvedValue(makeStaticByteArray(32, 0));
      cryptoFunctionService.compareFast.mockResolvedValue(true);
      cryptoFunctionService.aesDecryptFast.mockResolvedValue("data");

      const actual = await encryptService.decryptToUtf8(encString, key);
      expect(actual).toEqual("data");
      expect(cryptoFunctionService.compareFast).toHaveBeenCalledWith(
        makeStaticByteArray(32, 0),
        makeStaticByteArray(32, 0),
      );
    });

    it("decrypts data with provided key for Aes256Cbc", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32, 0));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");
      cryptoFunctionService.aesDecryptFastParameters.mockReturnValue({} as any);
      cryptoFunctionService.hmacFast.mockResolvedValue(makeStaticByteArray(32, 0));
      cryptoFunctionService.compareFast.mockResolvedValue(true);
      cryptoFunctionService.aesDecryptFast.mockResolvedValue("data");

      const actual = await encryptService.decryptToUtf8(encString, key);
      expect(actual).toEqual("data");
      expect(cryptoFunctionService.compareFast).not.toHaveBeenCalled();
    });

    it("returns null if key is Aes256Cbc_HmacSha256 but EncString is Aes256Cbc", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64, 0));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");

      const actual = await encryptService.decryptToUtf8(encString, key);
      expect(actual).toBeNull();
      expect(logService.error).toHaveBeenCalled();
    });

    it("returns null if key is Aes256Cbc but encstring is AesCbc256_HmacSha256", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32, 0));
      const encString = new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "data", "iv", "mac");

      const actual = await encryptService.decryptToUtf8(encString, key);
      expect(actual).toBeNull();
      expect(logService.error).toHaveBeenCalled();
    });

    it("returns null if macs don't match", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64, 0));
      const encString = new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "data", "iv", "mac");
      cryptoFunctionService.aesDecryptFastParameters.mockReturnValue({
        macData: makeStaticByteArray(32, 0),
        macKey: makeStaticByteArray(32, 0),
        mac: makeStaticByteArray(32, 0),
      } as any);
      cryptoFunctionService.hmacFast.mockResolvedValue(makeStaticByteArray(32, 0));
      cryptoFunctionService.compareFast.mockResolvedValue(false);
      cryptoFunctionService.aesDecryptFast.mockResolvedValue("data");

      const actual = await encryptService.decryptToUtf8(encString, key);
      expect(actual).toBeNull();
    });
  });

  describe("rsa", () => {
    const data = makeStaticByteArray(10, 100);
    const encryptedData = makeStaticByteArray(10, 150);
    const publicKey = makeStaticByteArray(10, 200);
    const privateKey = makeStaticByteArray(10, 250);
    const encString = makeEncString(encryptedData);

    function makeEncString(data: Uint8Array): EncString {
      return new EncString(EncryptionType.Rsa2048_OaepSha1_B64, Utils.fromBufferToB64(data));
    }

    describe("rsaEncrypt", () => {
      it("throws if no data is provided", () => {
        return expect(encryptService.rsaEncrypt(null, publicKey)).rejects.toThrow("No data");
      });

      it("throws if no public key is provided", () => {
        return expect(encryptService.rsaEncrypt(data, null)).rejects.toThrow("No public key");
      });

      it("encrypts data with provided key", async () => {
        cryptoFunctionService.rsaEncrypt.mockResolvedValue(encryptedData);

        const actual = await encryptService.rsaEncrypt(data, publicKey);

        expect(cryptoFunctionService.rsaEncrypt).toBeCalledWith(
          expect.toEqualBuffer(data),
          expect.toEqualBuffer(publicKey),
          "sha1",
        );

        expect(actual).toEqual(encString);
        expect(actual.dataBytes).toEqualBuffer(encryptedData);
      });
    });

    describe("rsaDecrypt", () => {
      it("throws if no data is provided", () => {
        return expect(encryptService.rsaDecrypt(null, privateKey)).rejects.toThrow("No data");
      });

      it("throws if no private key is provided", () => {
        return expect(encryptService.rsaDecrypt(encString, null)).rejects.toThrow("No private key");
      });

      it.each([
        EncryptionType.AesCbc256_B64,
        EncryptionType.AesCbc128_HmacSha256_B64,
        EncryptionType.AesCbc256_HmacSha256_B64,
      ])("throws if encryption type is %s", async (encType) => {
        encString.encryptionType = encType;

        await expect(encryptService.rsaDecrypt(encString, privateKey)).rejects.toThrow(
          "Invalid encryption type",
        );
      });

      it("decrypts data with provided key", async () => {
        cryptoFunctionService.rsaDecrypt.mockResolvedValue(data);

        const actual = await encryptService.rsaDecrypt(makeEncString(data), privateKey);

        expect(cryptoFunctionService.rsaDecrypt).toBeCalledWith(
          expect.toEqualBuffer(data),
          expect.toEqualBuffer(privateKey),
          "sha1",
        );

        expect(actual).toEqualBuffer(data);
      });
    });
  });

  describe("resolveLegacyKey", () => {
    it("creates a legacy key if required", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32), EncryptionType.AesCbc256_B64);
      const encString = mock<EncString>();
      encString.encryptionType = EncryptionType.AesCbc128_HmacSha256_B64;

      const actual = encryptService.resolveLegacyKey(key, encString);

      const expected = new SymmetricCryptoKey(key.key, EncryptionType.AesCbc128_HmacSha256_B64);
      expect(actual).toEqual(expected);
    });

    it("does not create a legacy key if not required", async () => {
      const encType = EncryptionType.AesCbc256_HmacSha256_B64;
      const key = new SymmetricCryptoKey(makeStaticByteArray(64), encType);
      const encString = mock<EncString>();
      encString.encryptionType = encType;

      const actual = encryptService.resolveLegacyKey(key, encString);

      expect(actual).toEqual(key);
    });
  });

  describe("hash", () => {
    it("hashes a string and returns b64", async () => {
      cryptoFunctionService.hash.mockResolvedValue(Uint8Array.from([1, 2, 3]));
      expect(await encryptService.hash("test", "sha256")).toEqual("AQID");
      expect(cryptoFunctionService.hash).toHaveBeenCalledWith("test", "sha256");
    });
  });

  describe("decryptItems", () => {
    it("returns empty array if no items are provided", async () => {
      const key = mock<SymmetricCryptoKey>();
      const actual = await encryptService.decryptItems(null, key);
      expect(actual).toEqual([]);
    });

    it("returns items decrypted with provided key", async () => {
      const key = mock<SymmetricCryptoKey>();
      const decryptable = {
        decrypt: jest.fn().mockResolvedValue("decrypted"),
      };
      const items = [decryptable];
      const actual = await encryptService.decryptItems(items as any, key);
      expect(actual).toEqual(["decrypted"]);
      expect(decryptable.decrypt).toHaveBeenCalledWith(key);
    });
  });
});
