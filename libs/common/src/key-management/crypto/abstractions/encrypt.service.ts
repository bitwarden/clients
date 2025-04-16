import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { Encrypted } from "../../../platform/interfaces/encrypted";
import { InitializerMetadata } from "../../../platform/interfaces/initializer-metadata.interface";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";

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

  /**
   * Encapsulates a symmetric key with an asymmetric public key
   * Note: This does not establish sender authenticity
   * @param sharedKey - The symmetric key that is to be shared
   * @param encapsulationKey - The encapsulation key (public key) of the receiver that the key is shared with
   */
  abstract encapsulateKeyUnsigned(
    sharedKey: SymmetricCryptoKey,
    encapsulationKey: Uint8Array,
  ): Promise<EncString>;
  /**
   * Decapsulates a shared symmetric key with an asymmetric private key
   * Note: This does not establish sender authenticity
   * @param encryptedSharedKey - The encrypted shared symmetric key
   * @param decapsulationKey - The key to decapsulate with (private key)
   */
  abstract decapsulateKeyUnsigned(
    encryptedSharedKey: EncString,
    decapsulationKey: Uint8Array,
  ): Promise<SymmetricCryptoKey>;
  /**
   * @deprecated Use encapsulateKeyUnsigned instead
   * @param data - The data to encrypt
   * @param publicKey - The public key to encrypt with
   */
  abstract rsaEncrypt(data: Uint8Array, publicKey: Uint8Array): Promise<EncString>;
  /**
   * @deprecated Use decapsulateKeyUnsigned instead
   * @param data - The ciphertext to decrypt
   * @param privateKey - The privateKey to decrypt with
   */
  abstract rsaDecrypt(data: EncString, privateKey: Uint8Array): Promise<Uint8Array>;
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

  abstract onServerConfigChange(newConfig: ServerConfig): void;
}
