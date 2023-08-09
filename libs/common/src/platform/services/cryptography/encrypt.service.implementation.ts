import { EncryptionType } from "../../../enums";
import { Utils } from "../../../platform/misc/utils";
import { CryptoFunctionService } from "../../abstractions/crypto-function.service";
import { EncryptService } from "../../abstractions/encrypt.service";
import { LogService } from "../../abstractions/log.service";
import { Decryptable } from "../../interfaces/decryptable.interface";
import { Encrypted } from "../../interfaces/encrypted";
import { InitializerMetadata } from "../../interfaces/initializer-metadata.interface";
import { EncArrayBuffer } from "../../models/domain/enc-array-buffer";
import { EncString } from "../../models/domain/enc-string";
import { EncryptedObject } from "../../models/domain/encrypted-object";
import { SymmetricCryptoKey } from "../../models/domain/symmetric-crypto-key";

export class EncryptServiceImplementation implements EncryptService {
  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected logMacFailures: boolean
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

  async decryptToUtf8(encString: EncString, key: SymmetricCryptoKey): Promise<string> {
    if (key == null) {
      throw new Error("No key provided for decryption.");
    }

    key = this.resolveLegacyKey(key, encString);

    if (key.macKey != null && encString?.mac == null) {
      this.logService.error("mac required.");
      return null;
    }

    if (key.encType !== encString.encryptionType) {
      this.logService.error("encType unavailable.");
      return null;
    }

    const fastParams = this.cryptoFunctionService.aesDecryptFastParameters(
      encString.data,
      encString.iv,
      encString.mac,
      key
    );
    if (fastParams.macKey != null && fastParams.mac != null) {
      const computedMac = await this.cryptoFunctionService.hmacFast(
        fastParams.macData,
        fastParams.macKey,
        "sha256"
      );
      const macsEqual = await this.cryptoFunctionService.compareFast(fastParams.mac, computedMac);
      if (!macsEqual) {
        this.logMacFailed("mac failed.");
        return null;
      }
    }

    return await this.cryptoFunctionService.aesDecryptFast(fastParams);
  }

  async decryptToBytes(encThing: Encrypted, key: SymmetricCryptoKey): Promise<Uint8Array> {
    if (key == null) {
      throw new Error("No encryption key provided.");
    }

    if (encThing == null) {
      throw new Error("Nothing provided for decryption.");
    }

    key = this.resolveLegacyKey(key, encThing);

    if (key.macKey != null && encThing.macBytes == null) {
      return null;
    }

    if (key.encType !== encThing.encryptionType) {
      return null;
    }

    if (key.macKey != null && encThing.macBytes != null) {
      const macData = new Uint8Array(encThing.ivBytes.byteLength + encThing.dataBytes.byteLength);
      macData.set(new Uint8Array(encThing.ivBytes), 0);
      macData.set(new Uint8Array(encThing.dataBytes), encThing.ivBytes.byteLength);
      const computedMac = await this.cryptoFunctionService.hmac(macData, key.macKey, "sha256");
      if (computedMac === null) {
        return null;
      }

      const macsMatch = await this.cryptoFunctionService.compare(encThing.macBytes, computedMac);
      if (!macsMatch) {
        this.logMacFailed("mac failed.");
        return null;
      }
    }

    const result = await this.cryptoFunctionService.aesDecrypt(
      encThing.dataBytes,
      encThing.ivBytes,
      key.encKey
    );

    return result ?? null;
  }

  async decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey
  ): Promise<T[]> {
    if (items == null || items.length < 1) {
      return [];
    }

    return await Promise.all(items.map((item) => item.decrypt(key)));
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
