import { ServerConfig } from "../../../platform/abstractions/config/server-config";
import { Decryptable } from "../../../platform/interfaces/decryptable.interface";
import { Encrypted } from "../../../platform/interfaces/encrypted";
import { InitializerMetadata } from "../../../platform/interfaces/initializer-metadata.interface";
import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { EncString } from "../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";

export abstract class EncryptService {
  /**
   * @param plainValue - The value to encrypt
   * @param key - The key to encrypt the value with
   */
  abstract encrypt(plainValue: string | Uint8Array, key: SymmetricCryptoKey): Promise<EncString>;
  /**
   * Encrypts a value to a Uint8Array
   * @param plainValue - The value to encrypt
   * @param key - The key to encrypt the value with
   */
  abstract encryptToBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncArrayBuffer>;

  /**
   * Wraps a decapsulation key (Private key) with a symmetric key
   * @param decapsulationKeyPcks8 - The private key in PKCS8 format
   * @param wrappingKey - The symmetric key to wrap the private key with
   */
  abstract wrapDecapsulationKey(
    decapsulationKeyPcks8: Uint8Array,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<EncString>;
  /**
   * Wraps an encapsulation key (Public key) with a symmetric key
   * @param encapsulationKeySpki - The public key in SPKI format
   * @param wrappingKey - The symmetric key to wrap the public key with
   */
  abstract wrapEncapsulationKey(
    encapsulationKeySpki: Uint8Array,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<EncString>;
  /**
   * Wraps a symmetric key with another symmetric key
   * @param keyToBeWrapped - The symmetric key to wrap
   * @param wrappingkey - The symmetric key to wrap the encapsulated key with
   */
  abstract wrapSymmetricKey(
    keyToBeWrapped: SymmetricCryptoKey,
    wrappingkey: SymmetricCryptoKey,
  ): Promise<EncString>;

  abstract rsaEncrypt(data: Uint8Array, publicKey: Uint8Array): Promise<EncString>;
  abstract rsaDecrypt(data: EncString, privateKey: Uint8Array): Promise<Uint8Array>;

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
