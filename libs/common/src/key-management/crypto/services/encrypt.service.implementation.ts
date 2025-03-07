// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CryptoFunctionService } from "@bitwarden/common/platform/abstractions/crypto-function.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import {
  EncryptionType,
  encryptionTypeToString as encryptionTypeName,
} from "@bitwarden/common/platform/enums";
import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { Encrypted } from "@bitwarden/common/platform/interfaces/encrypted";
import { InitializerMetadata } from "@bitwarden/common/platform/interfaces/initializer-metadata.interface";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { EncryptedObject } from "@bitwarden/common/platform/models/domain/encrypted-object";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { EncryptService } from "../abstractions/encrypt.service";

export class EncryptServiceImplementation implements EncryptService {
  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected logMacFailures: boolean,
  ) {}

  async encrypt(plainValue: string | Uint8Array, key: SymmetricCryptoKey): Promise<EncString> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (plainValue == null) {
      return Promise.resolve(null);
    }

    let plainBuf: Uint8Array;
    if (typeof plainValue === "string") {
      plainBuf = Utils.fromUtf8ToArray(plainValue);
    } else {
      plainBuf = plainValue;
    }

    const encObj = await this.aesEncrypt(plainBuf, key);
    const iv = Utils.fromBufferToB64(encObj.iv);
    const data = Utils.fromBufferToB64(encObj.data);
    const mac = encObj.mac != null ? Utils.fromBufferToB64(encObj.mac) : null;
    return new EncString(encObj.key.encType, data, iv, mac);
  }

  async encryptToBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    const encValue = await this.aesEncrypt(plainValue, key);
    let macLen = 0;
    if (encValue.mac != null) {
      macLen = encValue.mac.byteLength;
    }

    const encBytes = new Uint8Array(1 + encValue.iv.byteLength + macLen + encValue.data.byteLength);
    encBytes.set([encValue.key.encType]);
    encBytes.set(new Uint8Array(encValue.iv), 1);
    if (encValue.mac != null) {
      encBytes.set(new Uint8Array(encValue.mac), 1 + encValue.iv.byteLength);
    }

    encBytes.set(new Uint8Array(encValue.data), 1 + encValue.iv.byteLength + macLen);
    return new EncArrayBuffer(encBytes);
  }

  async decryptToUtf8(
    encString: EncString,
    key: SymmetricCryptoKey,
    decryptContext: string = "no context",
  ): Promise<string> {
    if (key == null) {
      throw new Error("No key provided for decryption.");
    }

    key = this.resolveLegacyKey(key, encString);

    // DO NOT REMOVE OR MOVE. This prevents downgrade to mac-less CBC, which would compromise integrity and confidentiality.
    if (key.macKey != null && encString?.mac == null) {
      this.logService.error(
        "[Encrypt service] Key has mac key but payload is missing mac bytes. Key type " +
          encryptionTypeName(key.encType) +
          "Payload type " +
          encryptionTypeName(encString.encryptionType),
        "Decrypt context: " + decryptContext,
      );
      return null;
    }

    if (key.encType !== encString.encryptionType) {
      this.logService.error(
        "[Encrypt service] Key encryption type does not match payload encryption type. Key type " +
          encryptionTypeName(key.encType) +
          "Payload type " +
          encryptionTypeName(encString.encryptionType),
        "Decrypt context: " + decryptContext,
      );
      return null;
    }

    const fastParams = this.cryptoFunctionService.aesDecryptFastParameters(
      encString.data,
      encString.iv,
      encString.mac,
      key,
    );
    if (fastParams.macKey != null && fastParams.mac != null) {
      const computedMac = await this.cryptoFunctionService.hmacFast(
        fastParams.macData,
        fastParams.macKey,
        "sha256",
      );
      const macsEqual = await this.cryptoFunctionService.compareFast(fastParams.mac, computedMac);
      if (!macsEqual) {
        this.logMacFailed(
          "[Encrypt service] decryptToUtf8 MAC comparison failed. Key or payload has changed. Key type " +
            encryptionTypeName(key.encType) +
            "Payload type " +
            encryptionTypeName(encString.encryptionType) +
            " Decrypt context: " +
            decryptContext,
        );
        return null;
      }
    }

    return await this.cryptoFunctionService.aesDecryptFast({ mode: "cbc", parameters: fastParams });
  }

  async decryptToBytes(
    encThing: Encrypted,
    key: SymmetricCryptoKey,
    decryptContext: string = "no context",
  ): Promise<Uint8Array | null> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (encThing == null) {
      throw new Error("Nothing provided for decryption.");
    }

    key = this.resolveLegacyKey(key, encThing);

    // DO NOT REMOVE OR MOVE. This prevents downgrade to mac-less CBC, which would compromise integrity and confidentiality.
    if (key.macKey != null && encThing.macBytes == null) {
      this.logService.error(
        "[Encrypt service] Key has mac key but payload is missing mac bytes. Key type " +
          encryptionTypeName(key.encType) +
          " Payload type " +
          encryptionTypeName(encThing.encryptionType) +
          " Decrypt context: " +
          decryptContext,
      );
      return null;
    }

    if (key.encType !== encThing.encryptionType) {
      this.logService.error(
        "[Encrypt service] Key encryption type does not match payload encryption type. Key type " +
          encryptionTypeName(key.encType) +
          " Payload type " +
          encryptionTypeName(encThing.encryptionType) +
          " Decrypt context: " +
          decryptContext,
      );
      return null;
    }

    if (key.macKey != null && encThing.macBytes != null) {
      const macData = new Uint8Array(encThing.ivBytes.byteLength + encThing.dataBytes.byteLength);
      macData.set(new Uint8Array(encThing.ivBytes), 0);
      macData.set(new Uint8Array(encThing.dataBytes), encThing.ivBytes.byteLength);
      const computedMac = await this.cryptoFunctionService.hmac(macData, key.macKey, "sha256");
      if (computedMac === null) {
        this.logMacFailed(
          "[Encrypt service#decryptToBytes] Failed to compute MAC." +
            " Key type " +
            encryptionTypeName(key.encType) +
            " Payload type " +
            encryptionTypeName(encThing.encryptionType) +
            " Decrypt context: " +
            decryptContext,
        );
        return null;
      }

      const macsMatch = await this.cryptoFunctionService.compare(encThing.macBytes, computedMac);
      if (!macsMatch) {
        this.logMacFailed(
          "[Encrypt service#decryptToBytes]: MAC comparison failed. Key or payload has changed." +
            " Key type " +
            encryptionTypeName(key.encType) +
            " Payload type " +
            encryptionTypeName(encThing.encryptionType) +
            " Decrypt context: " +
            decryptContext,
        );
        return null;
      }
    }

    const result = await this.cryptoFunctionService.aesDecrypt(
      encThing.dataBytes,
      encThing.ivBytes,
      key.encKey,
      "cbc",
    );

    return result ?? null;
  }

  async rsaEncrypt(data: Uint8Array, publicKey: Uint8Array): Promise<EncString> {
    if (data == null) {
      throw new Error("No data provided for encryption.");
    }

    if (publicKey == null) {
      throw new Error("No public key provided for encryption.");
    }
    const encrypted = await this.cryptoFunctionService.rsaEncrypt(data, publicKey, "sha1");
    return new EncString(EncryptionType.Rsa2048_OaepSha1_B64, Utils.fromBufferToB64(encrypted));
  }

  async rsaDecrypt(data: EncString, privateKey: Uint8Array): Promise<Uint8Array> {
    if (data == null) {
      throw new Error("[Encrypt service] rsaDecrypt: No data provided for decryption.");
    }

    let algorithm: "sha1" | "sha256";
    switch (data.encryptionType) {
      case EncryptionType.Rsa2048_OaepSha1_B64:
      case EncryptionType.Rsa2048_OaepSha1_HmacSha256_B64:
        algorithm = "sha1";
        break;
      case EncryptionType.Rsa2048_OaepSha256_B64:
      case EncryptionType.Rsa2048_OaepSha256_HmacSha256_B64:
        algorithm = "sha256";
        break;
      default:
        throw new Error("Invalid encryption type.");
    }

    if (privateKey == null) {
      throw new Error("[Encrypt service] rsaDecrypt: No private key provided for decryption.");
    }

    return this.cryptoFunctionService.rsaDecrypt(data.dataBytes, privateKey, algorithm);
  }

  /**
   * @deprecated Replaced by BulkEncryptService (PM-4154)
   */
  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]> {
    if (items == null || items.length < 1) {
      return [];
    }

    // don't use promise.all because this task is not io bound
    const results = [];
    for (let i = 0; i < items.length; i++) {
      results.push(await items[i].decrypt(key));
    }
    return results;
  }

  async hash(value: string | Uint8Array, algorithm: "sha1" | "sha256" | "sha512"): Promise<string> {
    const hashArray = await this.cryptoFunctionService.hash(value, algorithm);
    return Utils.fromBufferToB64(hashArray);
  }

  private async aesEncrypt(data: Uint8Array, key: SymmetricCryptoKey): Promise<EncryptedObject> {
    const obj = new EncryptedObject();
    obj.key = key;
    obj.iv = await this.cryptoFunctionService.randomBytes(16);
    obj.data = await this.cryptoFunctionService.aesEncrypt(data, obj.iv, obj.key.encKey);

    if (obj.key.macKey != null) {
      const macData = new Uint8Array(obj.iv.byteLength + obj.data.byteLength);
      macData.set(new Uint8Array(obj.iv), 0);
      macData.set(new Uint8Array(obj.data), obj.iv.byteLength);
      obj.mac = await this.cryptoFunctionService.hmac(macData, obj.key.macKey, "sha256");
    }

    return obj;
  }

  private logMacFailed(msg: string) {
    if (this.logMacFailures) {
      this.logService.error(msg);
    }
  }

  /**
   * Transform into new key for the old encrypt-then-mac scheme if required, otherwise return the current key unchanged
   * @param encThing The encrypted object (e.g. encString or encArrayBuffer) that you want to decrypt
   */
  resolveLegacyKey(key: SymmetricCryptoKey, encThing: Encrypted): SymmetricCryptoKey {
    if (
      encThing.encryptionType === EncryptionType.AesCbc128_HmacSha256_B64 &&
      key.encType === EncryptionType.AesCbc256_B64
    ) {
      return new SymmetricCryptoKey(key.key, EncryptionType.AesCbc128_HmacSha256_B64);
    }

    return key;
  }
}
