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

    if (key.encryptionType() === EncryptionType.AesCbc256_HmacSha256_B64) {
      const encObj = await this.aesEncrypt(plainBuf, key);
      const iv = Utils.fromBufferToB64(encObj.iv);
      const data = Utils.fromBufferToB64(encObj.data);
      const mac = Utils.fromBufferToB64(encObj.mac);
      return new EncString(key.encryptionType(), data, iv, mac);
    } else {
      throw new Error("Unsupported encryption type.");
    }
  }

  async encryptToBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (key.encryptionType() !== EncryptionType.AesCbc256_HmacSha256_B64) {
      const encValue = await this.aesEncrypt(plainValue, key);
      const encBytes = new Uint8Array(1 + encValue.iv.byteLength + encValue.mac.byteLength + encValue.data.byteLength);
      encBytes.set([key.encryptionType()]);
      encBytes.set(new Uint8Array(encValue.iv), 1);
      encBytes.set(new Uint8Array(encValue.mac), 1 + encValue.iv.byteLength);
      encBytes.set(new Uint8Array(encValue.data), 1 + encValue.iv.byteLength + encValue.mac.byteLength);
      return new EncArrayBuffer(encBytes);
    } else {
      throw new Error("Unsupported encryption type.");
    }
  }

  async decryptToUtf8(
    encString: EncString,
    key: SymmetricCryptoKey,
    decryptContext: string = "no context",
  ): Promise<string> {
    if (key == null) {
      throw new Error("No key provided for decryption.");
    }

    // DO NOT REMOVE OR MOVE. This prevents downgrade to mac-less CBC, which would compromise integrity and confidentiality.
    if (key.encryptionType() === EncryptionType.AesCbc256_HmacSha256_B64) {
      if (encString?.mac == null) {
        this.logService.error(
          "[Encrypt service] Key has mac key but payload is missing mac bytes. Key type " +
            encryptionTypeName(key.encryptionType()) +
            "Payload type " +
            encryptionTypeName(encString.encryptionType),
          "Decrypt context: " + decryptContext,
        );
        return null;
      }

      if (encString.encryptionType !== EncryptionType.AesCbc256_HmacSha256_B64) {
        this.logService.error(
          "[Encrypt service] Key encryption type does not match payload encryption type. Key type " +
            encryptionTypeName(key.encryptionType()) +
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
      const computedMac = await this.cryptoFunctionService.hmacFast(
        fastParams.macData,
        fastParams.macKey,
        "sha256",
      );
      const macsEqual = await this.cryptoFunctionService.compareFast(fastParams.mac, computedMac);
      if (!macsEqual) {
        this.logMacFailed(
          "[Encrypt service] decryptToUtf8 MAC comparison failed. Key or payload has changed. Key type " +
            encryptionTypeName(key.encryptionType()) +
            "Payload type " +
            encryptionTypeName(encString.encryptionType) +
            " Decrypt context: " +
            decryptContext,
        );
        return null;
      }

      return await this.cryptoFunctionService.aesDecryptFast({ mode: "cbc", parameters: fastParams });
    } else if (key.encryptionType() === EncryptionType.AesCbc256_B64) {
      return Utils.fromBufferToByteString(await this.cryptoFunctionService.aesDecrypt(encString.dataBytes, encString.ivBytes, key.getInnerKey().encryptionKey, "cbc"));
    } else {
      throw new Error("Unsupported encryption type.");
    }

  }

  async decryptToBytes(
    encThing: Encrypted,
    key: SymmetricCryptoKey,
    decryptContext: string = "no context",
  ): Promise<Uint8Array> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (encThing == null) {
      throw new Error("Nothing provided for decryption.");
    }

    const innerKey = key.getInnerKey();
    if (innerKey.type == EncryptionType.AesCbc256_HmacSha256_B64) {
      // DO NOT REMOVE OR MOVE. This prevents downgrade to mac-less CBC, which would compromise integrity and confidentiality.
      if (encThing.macBytes == null) {
        this.logService.error(
          "[Encrypt service] Key has mac key but payload is missing mac bytes. Key type " +
            encryptionTypeName(key.encryptionType()) +
            " Payload type " +
            encryptionTypeName(encThing.encryptionType) +
            " Decrypt context: " +
            decryptContext,
        );
        return null;
      }

      if (encThing.encryptionType !== EncryptionType.AesCbc256_HmacSha256_B64) {
        this.logService.error(
          "[Encrypt service] Key encryption type does not match payload encryption type. Key type " +
            encryptionTypeName(key.encryptionType()) +
            " Payload type " +
            encryptionTypeName(encThing.encryptionType) +
            " Decrypt context: " +
            decryptContext,
        );
        return null;
      }

      const macData = new Uint8Array(encThing.ivBytes.byteLength + encThing.dataBytes.byteLength);
      macData.set(new Uint8Array(encThing.ivBytes), 0);
      macData.set(new Uint8Array(encThing.dataBytes), encThing.ivBytes.byteLength);
      const computedMac = await this.cryptoFunctionService.hmac(macData, innerKey.authenticationKey, "sha256");
      if (computedMac === null) {
        this.logMacFailed(
          "[Encrypt service#decryptToBytes] Failed to compute MAC." +
            " Key type " +
            encryptionTypeName(key.encryptionType()) +
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
            encryptionTypeName(key.encryptionType()) +
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
      key.getInnerKey().encryptionKey,
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
    const innerKey = key.getInnerKey();
    if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      const obj = new EncryptedObject();
      // AES-CBC Encrypt the data
      obj.iv = await this.cryptoFunctionService.randomBytes(16);
      obj.data = await this.cryptoFunctionService.aesEncrypt(data, obj.iv, innerKey.encryptionKey);

      // Calculate the HMAC
      const macData = new Uint8Array(obj.iv.byteLength + obj.data.byteLength);
      macData.set(new Uint8Array(obj.iv), 0);
      macData.set(new Uint8Array(obj.data), obj.iv.byteLength);
      obj.mac = await this.cryptoFunctionService.hmac(macData, innerKey.authenticationKey, "sha256");

      return obj;
    } else {
      throw new Error("Unsupported encryption type.");
    }
  }

  private logMacFailed(msg: string) {
    if (this.logMacFailures) {
      this.logService.error(msg);
    }
  }
}
