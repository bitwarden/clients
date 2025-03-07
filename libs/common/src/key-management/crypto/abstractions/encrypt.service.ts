import { Decryptable } from "@bitwarden/common/platform/interfaces/decryptable.interface";
import { Encrypted } from "@bitwarden/common/platform/interfaces/encrypted";
import { InitializerMetadata } from "@bitwarden/common/platform/interfaces/initializer-metadata.interface";
import { EncArrayBuffer } from "@bitwarden/common/platform/models/domain/enc-array-buffer";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";

export abstract class EncryptService {
  /**
   * Encrypts a string to an EncString.
   * @throws Error when {@link key} is null
   * @param plainValue - The string to encrypt
   * @param key - The key to encrypt the string with
   * @returns The encrypted EncString. Returns null when key has mac key but payload is missing mac bytes or when key encryption type does not match payload encryption type or when MAC comparison failed.
   */
  abstract encrypt(
    plainValue: string | Uint8Array,
    key: SymmetricCryptoKey,
  ): Promise<EncString | null>;

  abstract encryptToBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer>;

  /**
   * Decrypts an EncString to a string
   * @param encString - The EncString to decrypt
   * @param key - The key to decrypt the EncString with
   * @param decryptTrace - A string to identify the context of the object being decrypted. This can include: field name, encryption type, cipher id, key type, but should not include
   * sensitive information like encryption keys or data. This is used for logging when decryption errors occur in order to identify what failed to decrypt
   * @returns The decrypted string. Returns null when {@link key} is null or when {@link encString}'s ${@link EncString.data} or ${@link EncString.iv} is null or when key has mac key but payload is missing mac bytes or when key encryption type does not match payload encryption type or when MAC comparison failed.
   */
  abstract decryptToUtf8(
    encString: EncString,
    key: SymmetricCryptoKey,
    decryptTrace?: string,
  ): Promise<string | null>;

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
