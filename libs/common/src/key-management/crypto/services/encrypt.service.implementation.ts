// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CryptoFunctionService } from "@bitwarden/common/key-management/crypto/abstractions/crypto-function.service";
import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkLoadService } from "@bitwarden/common/platform/abstractions/sdk/sdk-load.service";
import { EncryptionType } from "@bitwarden/common/platform/enums";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { PureCrypto } from "@bitwarden/sdk-internal";

import { EncryptService } from "../abstractions/encrypt.service";

export class EncryptServiceImplementation implements EncryptService {
  private disableType0Decryption = false;

  constructor(
    protected cryptoFunctionService: CryptoFunctionService,
    protected logService: LogService,
    protected logMacFailures: boolean,
  ) {}

  setDisableType0Decryption(disable: boolean): void {
    this.disableType0Decryption = disable;
  }

  async encryptString(plainValue: string, key: SymmetricCryptoKey): Promise<EncString> {
    if (plainValue == null) {
      this.logService.warning(
        "[EncryptService] WARNING: encryptString called with null value. Returning null, but this behavior is deprecated and will be removed.",
      );
      return null;
    }

    await SdkLoadService.Ready;
    return new EncString(PureCrypto.symmetric_encrypt_string(plainValue, key.toEncoded()));
  }

  async encryptBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncString> {
    await SdkLoadService.Ready;
    return new EncString(PureCrypto.symmetric_encrypt_bytes(plainValue, key.toEncoded()));
  }

  async encryptFileData(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer> {
    await SdkLoadService.Ready;
    return new EncArrayBuffer(PureCrypto.symmetric_encrypt_filedata(plainValue, key.toEncoded()));
  }

  async decryptString(encString: EncString, key: SymmetricCryptoKey): Promise<string> {
    if (this.disableType0Decryption && encString.encryptionType === EncryptionType.AesCbc256_B64) {
      throw new Error("Decryption of AesCbc256_B64 encrypted data is disabled.");
    }
    await SdkLoadService.Ready;
    return PureCrypto.symmetric_decrypt_string(encString.encryptedString, key.toEncoded());
  }

  async decryptBytes(encString: EncString, key: SymmetricCryptoKey): Promise<Uint8Array> {
    if (this.disableType0Decryption && encString.encryptionType === EncryptionType.AesCbc256_B64) {
      throw new Error("Decryption of AesCbc256_B64 encrypted data is disabled.");
    }
    await SdkLoadService.Ready;
    return PureCrypto.symmetric_decrypt_bytes(encString.encryptedString, key.toEncoded());
  }

  async decryptFileData(encBuffer: EncArrayBuffer, key: SymmetricCryptoKey): Promise<Uint8Array> {
    if (this.disableType0Decryption && encBuffer.encryptionType === EncryptionType.AesCbc256_B64) {
      throw new Error("Decryption of AesCbc256_B64 encrypted data is disabled.");
    }
    await SdkLoadService.Ready;
    return PureCrypto.symmetric_decrypt_filedata(encBuffer.buffer, key.toEncoded());
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

    await SdkLoadService.Ready;
    return new EncString(
      PureCrypto.wrap_decapsulation_key(decapsulationKeyPkcs8, wrappingKey.toEncoded()),
    );
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

    await SdkLoadService.Ready;
    return new EncString(
      PureCrypto.wrap_encapsulation_key(encapsulationKeySpki, wrappingKey.toEncoded()),
    );
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

    await SdkLoadService.Ready;
    return new EncString(
      PureCrypto.wrap_symmetric_key(keyToBeWrapped.toEncoded(), wrappingKey.toEncoded()),
    );
  }

  async unwrapDecapsulationKey(
    wrappedDecapsulationKey: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<Uint8Array> {
    if (wrappedDecapsulationKey == null) {
      throw new Error("No wrappedDecapsulationKey provided for unwrapping.");
    }
    if (wrappingKey == null) {
      throw new Error("No wrappingKey provided for unwrapping.");
    }

    if (
      this.disableType0Decryption &&
      wrappedDecapsulationKey.encryptionType === EncryptionType.AesCbc256_B64
    ) {
      throw new Error("Decryption of AesCbc256_B64 encrypted data is disabled.");
    }

    await SdkLoadService.Ready;
    return PureCrypto.unwrap_decapsulation_key(
      wrappedDecapsulationKey.encryptedString,
      wrappingKey.toEncoded(),
    );
  }
  async unwrapEncapsulationKey(
    wrappedEncapsulationKey: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<Uint8Array> {
    if (wrappedEncapsulationKey == null) {
      throw new Error("No wrappedEncapsulationKey provided for unwrapping.");
    }
    if (wrappingKey == null) {
      throw new Error("No wrappingKey provided for unwrapping.");
    }
    if (
      this.disableType0Decryption &&
      wrappedEncapsulationKey.encryptionType === EncryptionType.AesCbc256_B64
    ) {
      throw new Error("Decryption of AesCbc256_B64 encrypted data is disabled.");
    }

    await SdkLoadService.Ready;
    return PureCrypto.unwrap_encapsulation_key(
      wrappedEncapsulationKey.encryptedString,
      wrappingKey.toEncoded(),
    );
  }
  async unwrapSymmetricKey(
    keyToBeUnwrapped: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<SymmetricCryptoKey> {
    if (keyToBeUnwrapped == null) {
      throw new Error("No keyToBeUnwrapped provided for unwrapping.");
    }
    if (wrappingKey == null) {
      throw new Error("No wrappingKey provided for unwrapping.");
    }
    if (
      this.disableType0Decryption &&
      keyToBeUnwrapped.encryptionType === EncryptionType.AesCbc256_B64
    ) {
      throw new Error("Decryption of AesCbc256_B64 encrypted data is disabled.");
    }

    await SdkLoadService.Ready;
    return new SymmetricCryptoKey(
      PureCrypto.unwrap_symmetric_key(keyToBeUnwrapped.encryptedString, wrappingKey.toEncoded()),
    );
  }

  async hash(value: string | Uint8Array, algorithm: "sha1" | "sha256" | "sha512"): Promise<string> {
    const hashArray = await this.cryptoFunctionService.hash(value, algorithm);
    return Utils.fromBufferToB64(hashArray);
  }

  async encapsulateKeyUnsigned(
    sharedKey: SymmetricCryptoKey,
    encapsulationKey: Uint8Array,
  ): Promise<EncString> {
    if (sharedKey == null) {
      throw new Error("No sharedKey provided for encapsulation");
    }
    if (encapsulationKey == null) {
      throw new Error("No encapsulationKey provided for encapsulation");
    }
    await SdkLoadService.Ready;
    return new EncString(
      PureCrypto.encapsulate_key_unsigned(sharedKey.toEncoded(), encapsulationKey),
    );
  }

  async decapsulateKeyUnsigned(
    encryptedSharedKey: EncString,
    decapsulationKey: Uint8Array,
  ): Promise<SymmetricCryptoKey> {
    if (encryptedSharedKey == null) {
      throw new Error("No encryptedSharedKey provided for decapsulation");
    }
    if (decapsulationKey == null) {
      throw new Error("No decapsulationKey provided for decapsulation");
    }

    await SdkLoadService.Ready;
    const keyBytes = PureCrypto.decapsulate_key_unsigned(
      encryptedSharedKey.encryptedString,
      decapsulationKey,
    );
    return new SymmetricCryptoKey(keyBytes);
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
