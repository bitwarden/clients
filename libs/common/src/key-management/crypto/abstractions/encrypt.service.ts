import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { Encrypted } from "@bitwarden/common/platform/interfaces/encrypted";
import { InitializerMetadata } from "@bitwarden/common/platform/interfaces/initializer-metadata.interface";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

export abstract class EncryptService {
  abstract encrypt(plainValue: string | Uint8Array, key: SymmetricCryptoKey): Promise<EncString>;
  abstract encryptToBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer>;
  /**
   * Decrypts an EncString to a string
   * @param encString - The EncString to decrypt
   * @param key - The key to decrypt the EncString with
   * @param decryptTrace - A string to identify the context of the object being decrypted. This can include: field name, encryption type, cipher id, key type, but should not include
   * sensitive information like encryption keys or data. This is used for logging when decryption errors occur in order to identify what failed to decrypt
   * @returns The decrypted string
   */
  abstract decryptToUtf8(
    encString: EncString,
    key: SymmetricCryptoKey,
    decryptTrace?: string,
  ): Promise<string>;
  /**
   * Decrypts an Encrypted object to a Uint8Array
   * @param encThing - The Encrypted object to decrypt
   * @param key - The key to decrypt the Encrypted object with
   * @param decryptTrace - A string to identify the context of the object being decrypted. This can include: field name, encryption type, cipher id, key type, but should not include
   * sensitive information like encryption keys or data. This is used for logging when decryption errors occur in order to identify what failed to decrypt
   * @returns The decrypted Uint8Array
   */
  abstract decryptToBytes(
    encThing: Encrypted,
    key: SymmetricCryptoKey,
    decryptTrace?: string,
  ): Promise<Uint8Array | null>;
  abstract rsaEncrypt(data: Uint8Array, publicKey: Uint8Array): Promise<EncString>;
  abstract rsaDecrypt(data: EncString, privateKey: Uint8Array): Promise<Uint8Array>;
  abstract resolveLegacyKey(key: SymmetricCryptoKey, encThing: Encrypted): SymmetricCryptoKey;
  /**
   * @deprecated Replaced by BulkEncryptService, remove once the feature is tested and the featureflag PM-4154-multi-worker-encryption-service is removed
   * @param items The items to decrypt
   * @param key The key to decrypt the items with
   */
  abstract decryptItems<T extends InitializerMetadata>(
    items: Decryptable<T>[],
    key: SymmetricCryptoKey,
  ): Promise<T[]>;
  /**
   * Generates a base64-encoded hash of the given value
   * @param value The value to hash
   * @param algorithm The hashing algorithm to use
   */
  abstract hash(
    value: string | Uint8Array,
    algorithm: "sha1" | "sha256" | "sha512",
  ): Promise<string>;
}
