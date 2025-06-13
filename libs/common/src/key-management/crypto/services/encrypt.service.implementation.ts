// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
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
import { PureCrypto } from "@bitwarden/sdk-internal";

import {
  DefaultFeatureFlagValue,
  FeatureFlag,
  getFeatureFlagValue,
} from "../../../enums/feature-flag.enum";
import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { SdkLoadService } from "../../../platform/abstractions/sdk/sdk-load.service";
import { EncryptService } from "../abstractions/encrypt.service";

export class EncryptServiceImplementation implements EncryptService {
  protected useSDKForDecryption: boolean = DefaultFeatureFlagValue[FeatureFlag.UseSDKForDecryption];
  private blockType0: boolean = DefaultFeatureFlagValue[FeatureFlag.PM17987_BlockType0];

  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected logMacFailures: boolean,
  ) {}

  // Proxy functions; Their implementation are temporary before moving at this level to the SDK
  async encryptString(plainValue: string, key: SymmetricCryptoKey): Promise<EncString> {
    return this.encrypt(plainValue, key);
  }

  async encryptBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncString> {
    return this.encrypt(plainValue, key);
  }

  async encryptFileData(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    return this.encryptToBytes(plainValue, key);
  }

  async decryptString(encString: EncString, key: SymmetricCryptoKey): Promise<string> {
    return this.decryptToUtf8(encString, key);
  }

  async decryptBytes(encString: EncString, key: SymmetricCryptoKey): Promise<Uint8Array> {
    return this.decryptToBytes(encString, key);
  }

  async decryptFileData(encBuffer: EncArrayBuffer, key: SymmetricCryptoKey): Promise<Uint8Array> {
    return this.decryptToBytes(encBuffer, key);
  }

  async wrapDecapsulationKey(
    decapsulationKeyPkcs8: Uint8Array,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<EncString> {
    if (decapsulationKeyPkcs8 == null) {
      throw new Error("No decapsulation key provided for wrapping.");
    }

    if (wrappingKey == null) {
      throw new Error("No wrappingKey provided for wrapping.");
    }

    return await this.encryptUint8Array(decapsulationKeyPkcs8, wrappingKey);
  }

  async wrapEncapsulationKey(
    encapsulationKeySpki: Uint8Array,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<EncString> {
    if (encapsulationKeySpki == null) {
      throw new Error("No encapsulation key provided for wrapping.");
    }

    if (wrappingKey == null) {
      throw new Error("No wrappingKey provided for wrapping.");
    }

    return await this.encryptUint8Array(encapsulationKeySpki, wrappingKey);
  }

  async wrapSymmetricKey(
    keyToBeWrapped: SymmetricCryptoKey,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<EncString> {
    if (keyToBeWrapped == null) {
      throw new Error("No keyToBeWrapped provided for wrapping.");
    }

    if (wrappingKey == null) {
      throw new Error("No wrappingKey provided for wrapping.");
    }

    return await this.encryptUint8Array(keyToBeWrapped.toEncoded(), wrappingKey);
  }

  async unwrapDecapsulationKey(
    wrappedDecapsulationKey: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<Uint8Array> {
    return this.decryptBytes(wrappedDecapsulationKey, wrappingKey);
  }
  async unwrapEncapsulationKey(
    wrappedEncapsulationKey: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<Uint8Array> {
    return this.decryptBytes(wrappedEncapsulationKey, wrappingKey);
  }
  async unwrapSymmetricKey(
    keyToBeUnwrapped: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<SymmetricCryptoKey> {
    return new SymmetricCryptoKey(await this.decryptBytes(keyToBeUnwrapped, wrappingKey));
  }

  async hash(value: string | Uint8Array, algorithm: "sha1" | "sha256" | "sha512"): Promise<string> {
    const hashArray = await this.cryptoFunctionService.hash(value, algorithm);
    return Utils.fromBufferToB64(hashArray);
  }

  // Handle updating private properties to turn on/off feature flags.
  onServerConfigChange(newConfig: ServerConfig): void {
    const oldFlagValue = this.useSDKForDecryption;
    this.useSDKForDecryption = getFeatureFlagValue(newConfig, FeatureFlag.UseSDKForDecryption);
    this.logService.debug(
      "[EncryptService] Updated sdk decryption flag",
      oldFlagValue,
      this.useSDKForDecryption,
    );
    this.blockType0 = getFeatureFlagValue(newConfig, FeatureFlag.PM17987_BlockType0);
  }

  async encrypt(plainValue: string | Uint8Array, key: SymmetricCryptoKey): Promise<EncString> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (this.blockType0) {
      if (key.inner().type === EncryptionType.AesCbc256_B64) {
        throw new Error("Type 0 encryption is not supported.");
      }
    }

    if (plainValue == null) {
      return Promise.resolve(null);
    }

    if (typeof plainValue === "string") {
      return this.encryptUint8Array(Utils.fromUtf8ToArray(plainValue), key);
    } else {
      return this.encryptUint8Array(plainValue, key);
    }
  }

  private async encryptUint8Array(
    plainValue: Uint8Array,
    key: SymmetricCryptoKey,
  ): Promise<EncString> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (this.blockType0) {
      if (key.inner().type === EncryptionType.AesCbc256_B64) {
        throw new Error("Type 0 encryption is not supported.");
      }
    }

    if (plainValue == null) {
      return Promise.resolve(null);
    }

    const innerKey = key.inner();
    if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      const encObj = await this.aesEncrypt(plainValue, innerKey);
      const iv = Utils.fromBufferToB64(encObj.iv);
      const data = Utils.fromBufferToB64(encObj.data);
      const mac = Utils.fromBufferToB64(encObj.mac);
      return new EncString(innerKey.type, data, iv, mac);
    } else if (innerKey.type === EncryptionType.AesCbc256_B64) {
      const encObj = await this.aesEncryptLegacy(plainValue, innerKey);
      const iv = Utils.fromBufferToB64(encObj.iv);
      const data = Utils.fromBufferToB64(encObj.data);
      return new EncString(innerKey.type, data, iv);
    }
  }

  async encryptToBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (this.blockType0) {
      if (key.inner().type === EncryptionType.AesCbc256_B64) {
        throw new Error("Type 0 encryption is not supported.");
      }
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
    if (this.useSDKForDecryption) {
      this.logService.debug("decrypting with SDK");
      if (encString == null || encString.encryptedString == null) {
        throw new Error("encString is null or undefined");
      }
      await SdkLoadService.Ready;
      return PureCrypto.symmetric_decrypt(encString.encryptedString, key.toEncoded());
    }
    this.logService.debug("decrypting with javascript");

    if (key == null) {
      throw new Error("No key provided for decryption.");
    }

    const innerKey = key.inner();
    if (encString.encryptionType !== innerKey.type) {
      this.logDecryptError(
        "Key encryption type does not match payload encryption type",
        innerKey.type,
        encString.encryptionType,
        decryptContext,
      );
      return null;
    }

    if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
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
          innerKey.type,
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
      const fastParams = this.cryptoFunctionService.aesDecryptFastParameters(
        encString.data,
        encString.iv,
        undefined,
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
    if (this.useSDKForDecryption) {
      this.logService.debug("[EncryptService] Decrypting bytes with SDK");
      if (
        encThing.encryptionType == null ||
        encThing.ivBytes == null ||
        encThing.dataBytes == null
      ) {
        throw new Error("Cannot decrypt, missing type, IV, or data bytes.");
      }
      const buffer = EncArrayBuffer.fromParts(
        encThing.encryptionType,
        encThing.ivBytes,
        encThing.dataBytes,
        encThing.macBytes,
      ).buffer;
      await SdkLoadService.Ready;
      return PureCrypto.symmetric_decrypt_array_buffer(buffer, key.toEncoded());
    }
    this.logService.debug("[EncryptService] Decrypting bytes with javascript");

    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (encThing == null) {
      throw new Error("Nothing provided for decryption.");
    }

    const inner = key.inner();
    if (encThing.encryptionType !== inner.type) {
      this.logDecryptError(
        "Encryption key type mismatch",
        inner.type,
        encThing.encryptionType,
        decryptContext,
      );
      return null;
    }

    if (inner.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      if (encThing.macBytes == null) {
        this.logDecryptError("Mac missing", inner.type, encThing.encryptionType, decryptContext);
        return null;
      }

      const macData = new Uint8Array(encThing.ivBytes.byteLength + encThing.dataBytes.byteLength);
      macData.set(new Uint8Array(encThing.ivBytes), 0);
      macData.set(new Uint8Array(encThing.dataBytes), encThing.ivBytes.byteLength);
      const computedMac = await this.cryptoFunctionService.hmac(
        macData,
        inner.authenticationKey,
        "sha256",
      );
      const macsMatch = await this.cryptoFunctionService.compare(encThing.macBytes, computedMac);
      if (!macsMatch) {
        this.logMacFailed(
          "MAC comparison failed. Key or payload has changed.",
          inner.type,
          encThing.encryptionType,
          decryptContext,
        );
        return null;
      }

      return await this.cryptoFunctionService.aesDecrypt(
        encThing.dataBytes,
        encThing.ivBytes,
        inner.encryptionKey,
        "cbc",
      );
    } else if (inner.type === EncryptionType.AesCbc256_B64) {
      return await this.cryptoFunctionService.aesDecrypt(
        encThing.dataBytes,
        encThing.ivBytes,
        inner.encryptionKey,
        "cbc",
      );
    }
  }

  async encapsulateKeyUnsigned(
    sharedKey: SymmetricCryptoKey,
    encapsulationKey: Uint8Array,
  ): Promise<EncString> {
    if (sharedKey == null) {
      throw new Error("No sharedKey provided for encapsulation");
    }
    return await this.rsaEncrypt(sharedKey.toEncoded(), encapsulationKey);
  }

  async decapsulateKeyUnsigned(
    encryptedSharedKey: EncString,
    decapsulationKey: Uint8Array,
  ): Promise<SymmetricCryptoKey> {
    const keyBytes = await this.rsaDecrypt(encryptedSharedKey, decapsulationKey);
    return new SymmetricCryptoKey(keyBytes);
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
}
