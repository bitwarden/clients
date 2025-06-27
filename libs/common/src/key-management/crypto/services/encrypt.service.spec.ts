import { mockReset, mock } from "jest-mock-extended";

import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import {
  Aes256CbcHmacKey,
  SymmetricCryptoKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { CsprngArray } from "@bitwarden/common/types/csprng";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { makeStaticByteArray } from "../../../../spec";
import { DefaultFeatureFlagValue, FeatureFlag } from "../../../enums/feature-flag.enum";
import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";

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

  describe("wrapSymmetricKey", () => {
    it("roundtrip encrypts and decrypts a symmetric key", async () => {
      cryptoFunctionService.aesEncrypt.mockResolvedValue(makeStaticByteArray(64, 0));
      cryptoFunctionService.randomBytes.mockResolvedValue(makeStaticByteArray(16) as CsprngArray);
      cryptoFunctionService.hmac.mockResolvedValue(makeStaticByteArray(32));

      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = await encryptService.wrapSymmetricKey(key, wrappingKey);
      expect(encString.encryptionType).toEqual(EncryptionType.AesCbc256_HmacSha256_B64);
      expect(encString.data).toEqual(Utils.fromBufferToB64(makeStaticByteArray(64, 0)));
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
    it("fails if type 0 key is provided with flag turned on", async () => {
      (encryptService as any).blockType0 = true;
      const mock32Key = mock<SymmetricCryptoKey>();
      mock32Key.inner.mockReturnValue({
        type: 0,
        encryptionKey: makeStaticByteArray(32),
      });

      await expect(encryptService.wrapSymmetricKey(mock32Key, mock32Key)).rejects.toThrow(
        "Type 0 encryption is not supported.",
      );
    });
  });

  describe("wrapDecapsulationKey", () => {
    it("roundtrip encrypts and decrypts a decapsulation key", async () => {
      cryptoFunctionService.aesEncrypt.mockResolvedValue(makeStaticByteArray(64, 0));
      cryptoFunctionService.randomBytes.mockResolvedValue(makeStaticByteArray(16) as CsprngArray);
      cryptoFunctionService.hmac.mockResolvedValue(makeStaticByteArray(32));

      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = await encryptService.wrapDecapsulationKey(
        makeStaticByteArray(64),
        wrappingKey,
      );
      expect(encString.encryptionType).toEqual(EncryptionType.AesCbc256_HmacSha256_B64);
      expect(encString.data).toEqual(Utils.fromBufferToB64(makeStaticByteArray(64, 0)));
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
    it("throws if type 0 key is provided with flag turned on", async () => {
      (encryptService as any).blockType0 = true;
      const mock32Key = mock<SymmetricCryptoKey>();
      mock32Key.inner.mockReturnValue({
        type: 0,
        encryptionKey: makeStaticByteArray(32),
      });

      await expect(
        encryptService.wrapDecapsulationKey(new Uint8Array(200), mock32Key),
      ).rejects.toThrow("Type 0 encryption is not supported.");
    });
  });

  describe("wrapEncapsulationKey", () => {
    it("roundtrip encrypts and decrypts an encapsulationKey key", async () => {
      cryptoFunctionService.aesEncrypt.mockResolvedValue(makeStaticByteArray(64, 0));
      cryptoFunctionService.randomBytes.mockResolvedValue(makeStaticByteArray(16) as CsprngArray);
      cryptoFunctionService.hmac.mockResolvedValue(makeStaticByteArray(32));

      const wrappingKey = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = await encryptService.wrapEncapsulationKey(
        makeStaticByteArray(64),
        wrappingKey,
      );
      expect(encString.encryptionType).toEqual(EncryptionType.AesCbc256_HmacSha256_B64);
      expect(encString.data).toEqual(Utils.fromBufferToB64(makeStaticByteArray(64, 0)));
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
    it("throws if type 0 key is provided with flag turned on", async () => {
      (encryptService as any).blockType0 = true;
      const mock32Key = mock<SymmetricCryptoKey>();
      mock32Key.inner.mockReturnValue({
        type: 0,
        encryptionKey: makeStaticByteArray(32),
      });

      await expect(
        encryptService.wrapEncapsulationKey(new Uint8Array(200), mock32Key),
      ).rejects.toThrow("Type 0 encryption is not supported.");
    });
  });

  describe("onServerConfigChange", () => {
    const newConfig = mock<ServerConfig>();

    afterEach(() => {
      jest.resetAllMocks();
    });

    it("updates internal flag with default value when not present in config", () => {
      encryptService.onServerConfigChange(newConfig);

      expect((encryptService as any).blockType0).toBe(
        DefaultFeatureFlagValue[FeatureFlag.PM17987_BlockType0],
      );
    });

    test.each([true, false])("updates internal flag with value in config", (expectedValue) => {
      newConfig.featureStates = { [FeatureFlag.PM17987_BlockType0]: expectedValue };

      encryptService.onServerConfigChange(newConfig);

      expect((encryptService as any).blockType0).toBe(expectedValue);
    });
  });

  describe("encrypt", () => {
    it("throws if no key is provided", () => {
      return expect(encryptService.encrypt(null, null)).rejects.toThrow(
        "No encryption key provided.",
      );
    });

    it("throws if type 0 key is provided with flag turned on", async () => {
      (encryptService as any).blockType0 = true;
      const key = new SymmetricCryptoKey(makeStaticByteArray(32));
      const mock32Key = mock<SymmetricCryptoKey>();
      mock32Key.inner.mockReturnValue({
        type: 0,
        encryptionKey: makeStaticByteArray(32),
      });

      await expect(encryptService.encrypt(null!, key)).rejects.toThrow(
        "Type 0 encryption is not supported.",
      );
      await expect(encryptService.encrypt(null!, mock32Key)).rejects.toThrow(
        "Type 0 encryption is not supported.",
      );

      const plainValue = "data";
      await expect(encryptService.encrypt(plainValue, key)).rejects.toThrow(
        "Type 0 encryption is not supported.",
      );
      await expect(encryptService.encrypt(plainValue, mock32Key)).rejects.toThrow(
        "Type 0 encryption is not supported.",
      );
    });

    it("returns null if no data is provided with valid key", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
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

    it("throws if type 0 key provided with flag turned on", async () => {
      (encryptService as any).blockType0 = true;
      const key = new SymmetricCryptoKey(makeStaticByteArray(32));
      const mock32Key = mock<SymmetricCryptoKey>();
      mock32Key.inner.mockReturnValue({
        type: 0,
        encryptionKey: makeStaticByteArray(32),
      });

      await expect(encryptService.encryptToBytes(plainValue, key)).rejects.toThrow(
        "Type 0 encryption is not supported.",
      );

      await expect(encryptService.encryptToBytes(plainValue, mock32Key)).rejects.toThrow(
        "Type 0 encryption is not supported.",
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

    it("calls PureCrypto when useSDKForDecryption is true", async () => {
      (encryptService as any).useSDKForDecryption = true;
      const decryptedBytes = makeStaticByteArray(10, 200);
      Object.defineProperty(SdkLoadService, "Ready", {
        value: Promise.resolve(),
        configurable: true,
      });
      jest.spyOn(PureCrypto, "symmetric_decrypt_array_buffer").mockReturnValue(decryptedBytes);

      const actual = await encryptService.decryptToBytes(encBuffer, key);

      expect(PureCrypto.symmetric_decrypt_array_buffer).toHaveBeenCalledWith(
        encBuffer.buffer,
        key.toEncoded(),
      );
      expect(actual).toEqualBuffer(decryptedBytes);
    });

    it("decrypts data with provided key for Aes256CbcHmac", async () => {
      const decryptedBytes = makeStaticByteArray(10, 200);

      cryptoFunctionService.hmac.mockResolvedValue(makeStaticByteArray(1));
      cryptoFunctionService.compare.mockResolvedValue(true);
      cryptoFunctionService.aesDecrypt.mockResolvedValueOnce(decryptedBytes);

      const actual = await encryptService.decryptToBytes(encBuffer, key);

      expect(cryptoFunctionService.aesDecrypt).toBeCalledWith(
        expect.toEqualBuffer(encBuffer.dataBytes),
        expect.toEqualBuffer(encBuffer.ivBytes),
        expect.toEqualBuffer(key.inner().encryptionKey),
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
        expect.toEqualBuffer(key.inner().encryptionKey),
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
        (key.inner() as Aes256CbcHmacKey).authenticationKey,
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

    it("calls PureCrypto when useSDKForDecryption is true", async () => {
      (encryptService as any).useSDKForDecryption = true;
      const key = new SymmetricCryptoKey(makeStaticByteArray(64, 0));
      const encString = new EncString(EncryptionType.AesCbc256_HmacSha256_B64, "data", "iv", "mac");
      Object.defineProperty(SdkLoadService, "Ready", {
        value: Promise.resolve(),
        configurable: true,
      });
      jest.spyOn(PureCrypto, "symmetric_decrypt").mockReturnValue("data");

      const actual = await encryptService.decryptToUtf8(encString, key);

      expect(actual).toEqual("data");
      expect(PureCrypto.symmetric_decrypt).toHaveBeenCalledWith(
        encString.encryptedString,
        key.toEncoded(),
      );
    });

    it("decrypts data with provided key for AesCbc256_HmacSha256", async () => {
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

    it("decrypts data with provided key for AesCbc256", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(32, 0));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");
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
      expect(cryptoFunctionService.compareFast).not.toHaveBeenCalled();
    });

    it("returns null if key is AesCbc256_HMAC but encstring is AesCbc256", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64, 0));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");

      const actual = await encryptService.decryptToUtf8(encString, key);
      expect(actual).toBeNull();
      expect(logService.error).toHaveBeenCalled();
    });

    it("returns null if key is AesCbc256 but encstring is AesCbc256_HMAC", async () => {
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

  describe("decryptToUtf8", () => {
    it("throws if no key is provided", () => {
      return expect(encryptService.decryptToUtf8(null, null)).rejects.toThrow(
        "No key provided for decryption.",
      );
    });
    it("returns null if key is mac key but encstring has no mac", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64, 0));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");

      const actual = await encryptService.decryptToUtf8(encString, key);
      expect(actual).toBeNull();
      expect(logService.error).toHaveBeenCalled();
    });
  });

  describe("encryptString", () => {
    it("is a proxy to encrypt", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const plainValue = "data";
      encryptService.encrypt = jest.fn();
      await encryptService.encryptString(plainValue, key);
      expect(encryptService.encrypt).toHaveBeenCalledWith(plainValue, key);
    });
  });

  describe("encryptBytes", () => {
    it("is a proxy to encrypt", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const plainValue = makeStaticByteArray(16, 1);
      encryptService.encrypt = jest.fn();
      await encryptService.encryptBytes(plainValue, key);
      expect(encryptService.encrypt).toHaveBeenCalledWith(plainValue, key);
    });
  });

  describe("encryptFileData", () => {
    it("is a proxy to encryptToBytes", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const plainValue = makeStaticByteArray(16, 1);
      encryptService.encryptToBytes = jest.fn();
      await encryptService.encryptFileData(plainValue, key);
      expect(encryptService.encryptToBytes).toHaveBeenCalledWith(plainValue, key);
    });
  });

  describe("decryptString", () => {
    it("is a proxy to decryptToUtf8", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");
      encryptService.decryptToUtf8 = jest.fn();
      await encryptService.decryptString(encString, key);
      expect(encryptService.decryptToUtf8).toHaveBeenCalledWith(encString, key);
    });
  });

  describe("decryptBytes", () => {
    it("is a proxy to decryptToBytes", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");
      encryptService.decryptToBytes = jest.fn();
      await encryptService.decryptBytes(encString, key);
      expect(encryptService.decryptToBytes).toHaveBeenCalledWith(encString, key);
    });
  });

  describe("decryptFileData", () => {
    it("is a proxy to decrypt", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncArrayBuffer(makeStaticByteArray(60, EncryptionType.AesCbc256_B64));
      encryptService.decryptToBytes = jest.fn();
      await encryptService.decryptFileData(encString, key);
      expect(encryptService.decryptToBytes).toHaveBeenCalledWith(encString, key);
    });
  });

  describe("unwrapDecapsulationKey", () => {
    it("is a proxy to decryptBytes", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");
      encryptService.decryptBytes = jest.fn();
      await encryptService.unwrapDecapsulationKey(encString, key);
      expect(encryptService.decryptBytes).toHaveBeenCalledWith(encString, key);
    });
  });

  describe("unwrapEncapsulationKey", () => {
    it("is a proxy to decryptBytes", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");
      encryptService.decryptBytes = jest.fn();
      await encryptService.unwrapEncapsulationKey(encString, key);
      expect(encryptService.decryptBytes).toHaveBeenCalledWith(encString, key);
    });
  });

  describe("unwrapSymmetricKey", () => {
    it("is a proxy to decryptBytes", async () => {
      const key = new SymmetricCryptoKey(makeStaticByteArray(64));
      const encString = new EncString(EncryptionType.AesCbc256_B64, "data");
      const jestFn = jest.fn();
      jestFn.mockResolvedValue(new Uint8Array(64));
      encryptService.decryptBytes = jestFn;
      await encryptService.unwrapSymmetricKey(encString, key);
      expect(encryptService.decryptBytes).toHaveBeenCalledWith(encString, key);
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
          "No public key",
        );
      });

      it("encrypts data with provided key", async () => {
        cryptoFunctionService.rsaEncrypt.mockResolvedValue(encryptedData);

        const actual = await encryptService.encapsulateKeyUnsigned(testKey, publicKey);

        expect(cryptoFunctionService.rsaEncrypt).toBeCalledWith(
          expect.toEqualBuffer(testKey.toEncoded()),
          expect.toEqualBuffer(publicKey),
          "sha1",
        );

        expect(actual).toEqual(encString);
        expect(actual.dataBytes).toEqualBuffer(encryptedData);
      });

      it("throws if no data was provided", () => {
        return expect(encryptService.rsaEncrypt(null, new Uint8Array(32))).rejects.toThrow(
          "No data provided for encryption",
        );
      });
    });

    describe("decapsulateKeyUnsigned", () => {
      it("throws if no data is provided", () => {
        return expect(encryptService.decapsulateKeyUnsigned(null, privateKey)).rejects.toThrow(
          "No data",
        );
      });

      it("throws if no private key is provided", () => {
        return expect(encryptService.decapsulateKeyUnsigned(encString, null)).rejects.toThrow(
          "No private key",
        );
      });

      it.each([EncryptionType.AesCbc256_B64, EncryptionType.AesCbc256_HmacSha256_B64])(
        "throws if encryption type is %s",
        async (encType) => {
          encString.encryptionType = encType;

          await expect(
            encryptService.decapsulateKeyUnsigned(encString, privateKey),
          ).rejects.toThrow("Invalid encryption type");
        },
      );

      it("decrypts data with provided key", async () => {
        cryptoFunctionService.rsaDecrypt.mockResolvedValue(data);

        const actual = await encryptService.decapsulateKeyUnsigned(makeEncString(data), privateKey);

        expect(cryptoFunctionService.rsaDecrypt).toBeCalledWith(
          expect.toEqualBuffer(data),
          expect.toEqualBuffer(privateKey),
          "sha1",
        );

        expect(actual.toEncoded()).toEqualBuffer(data);
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
