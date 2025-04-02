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
import {
  Aes256CbcHmacKey,
  Aes256CbcKey,
  SymmetricCryptoKey,
} from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { EncryptService } from "../abstractions/encrypt.service";

export class EncryptServiceImplementation implements EncryptService {
  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected logMacFailures: boolean,
  ) {}

  // Handle updating private properties to turn on/off feature flags.
  onServerConfigChange(newConfig: ServerConfig): void {
    return;
  }

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

    const innerKey = key.inner();
    if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      const encObj = await this.aesEncrypt(plainBuf, innerKey);
      const iv = Utils.fromBufferToB64(encObj.iv);
      const data = Utils.fromBufferToB64(encObj.data);
      const mac = Utils.fromBufferToB64(encObj.mac);
      return new EncString(innerKey.type, data, iv, mac);
    } else {
      throw new Error(`Encrypt is not supported for keys of type ${innerKey.type}`);
    }
  }

  async encryptToBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    const innerKey = key.inner();
    if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      const encValue = await this.aesEncrypt(plainValue, innerKey);
      const macLen = encValue.mac.length;
      const encBytes = new Uint8Array(
        1 + encValue.iv.byteLength + macLen + encValue.data.byteLength,
      );
      encBytes.set([innerKey.type]);
      encBytes.set(new Uint8Array(encValue.iv), 1);
      encBytes.set(new Uint8Array(encValue.mac), 1 + encValue.iv.byteLength);
      encBytes.set(new Uint8Array(encValue.data), 1 + encValue.iv.byteLength + macLen);
      return new EncArrayBuffer(encBytes);
    } else if (innerKey.type === EncryptionType.AesCbc256_B64) {
      const encValue = await this.aesEncryptLegacy(plainValue, innerKey);
      const encBytes = new Uint8Array(1 + encValue.iv.byteLength + encValue.data.byteLength);
      encBytes.set([innerKey.type]);
      encBytes.set(new Uint8Array(encValue.iv), 1);
      encBytes.set(new Uint8Array(encValue.data), 1 + encValue.iv.byteLength);
      return new EncArrayBuffer(encBytes);
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

    const innerKey = key.inner();
    if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      if (encString.encryptionType !== EncryptionType.AesCbc256_HmacSha256_B64) {
        this.logDecryptError(
          "Key encryption type does not match payload encryption type",
          key.encType,
          encString.encryptionType,
          decryptContext,
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
          "decryptToUtf8 MAC comparison failed. Key or payload has changed.",
          key.encType,
          encString.encryptionType,
          decryptContext,
        );
        return null;
      }
      return await this.cryptoFunctionService.aesDecryptFast({
        mode: "cbc",
        parameters: fastParams,
      });
    } else if (innerKey.type === EncryptionType.AesCbc256_B64) {
      if (encString.encryptionType !== EncryptionType.AesCbc256_B64) {
        this.logDecryptError(
          "Key encryption type does not match payload encryption type",
          key.encType,
          encString.encryptionType,
          decryptContext,
        );
        return null;
      }

      const fastParams = this.cryptoFunctionService.aesDecryptFastParameters(
        encString.data,
        encString.iv,
        null,
        key,
      );
      return await this.cryptoFunctionService.aesDecryptFast({
        mode: "cbc",
        parameters: fastParams,
      });
    } else {
      throw new Error(`Unsupported encryption type`);
    }
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

    const inner = key.inner();
    if (inner.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      if (
        encThing.encryptionType !== EncryptionType.AesCbc256_HmacSha256_B64 ||
        encThing.macBytes === null
      ) {
        this.logDecryptError(
          "Encryption key type mismatch",
          key.encType,
          encThing.encryptionType,
          decryptContext,
        );
        return null;
      }

      const macData = new Uint8Array(encThing.ivBytes.byteLength + encThing.dataBytes.byteLength);
      macData.set(new Uint8Array(encThing.ivBytes), 0);
      macData.set(new Uint8Array(encThing.dataBytes), encThing.ivBytes.byteLength);
      const computedMac = await this.cryptoFunctionService.hmac(macData, key.macKey, "sha256");
      const macsMatch = await this.cryptoFunctionService.compare(encThing.macBytes, computedMac);
      if (!macsMatch) {
        this.logMacFailed(
          "MAC comparison failed. Key or payload has changed.",
          key.encType,
          encThing.encryptionType,
          decryptContext,
        );
        return null;
      }

      return await this.cryptoFunctionService.aesDecrypt(
        encThing.dataBytes,
        encThing.ivBytes,
        key.encKey,
        "cbc",
      );
    } else if (inner.type === EncryptionType.AesCbc256_B64) {
      if (encThing.encryptionType !== EncryptionType.AesCbc256_B64) {
        this.logDecryptError(
          "Encryption key type mismatch",
          key.encType,
          encThing.encryptionType,
          decryptContext,
        );
        return null;
      }

      return await this.cryptoFunctionService.aesDecrypt(
        encThing.dataBytes,
        encThing.ivBytes,
        key.encKey,
        "cbc",
      );
    }
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

  private async aesEncrypt(data: Uint8Array, key: Aes256CbcHmacKey): Promise<EncryptedObject> {
    const obj = new EncryptedObject();
    obj.iv = await this.cryptoFunctionService.randomBytes(16);
    obj.data = await this.cryptoFunctionService.aesEncrypt(data, obj.iv, key.encryptionKey);

    const macData = new Uint8Array(obj.iv.byteLength + obj.data.byteLength);
    macData.set(new Uint8Array(obj.iv), 0);
    macData.set(new Uint8Array(obj.data), obj.iv.byteLength);
    obj.mac = await this.cryptoFunctionService.hmac(macData, key.authenticationKey, "sha256");

    return obj;
  }

  /**
   * @deprecated Removed once AesCbc256_B64 support is removed
   */
  private async aesEncryptLegacy(data: Uint8Array, key: Aes256CbcKey): Promise<EncryptedObject> {
    const obj = new EncryptedObject();
    obj.iv = await this.cryptoFunctionService.randomBytes(16);
    obj.data = await this.cryptoFunctionService.aesEncrypt(data, obj.iv, key.encryptionKey);
    return obj;
  }

  private logDecryptError(
    msg: string,
    keyEncType: EncryptionType,
    dataEncType: EncryptionType,
    decryptContext: string,
  ) {
    this.logService.error(
      `[Encrypt service] ${msg} Key type ${encryptionTypeName(keyEncType)} Payload type ${encryptionTypeName(dataEncType)} Decrypt context: ${decryptContext}`,
    );
  }

  private logMacFailed(
    msg: string,
    keyEncType: EncryptionType,
    dataEncType: EncryptionType,
    decryptContext: string,
  ) {
    if (this.logMacFailures) {
      this.logDecryptError(msg, keyEncType, dataEncType, decryptContext);
    }
  }
}
