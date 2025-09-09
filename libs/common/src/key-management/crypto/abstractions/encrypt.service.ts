import { EncArrayBuffer } from "../../../platform/models/domain/enc-array-buffer";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { EncString } from "../models/enc-string";

export abstract class EncryptService {
  /**
   * Encrypts a string to an EncString
   * @param plainValue - The value to encrypt
   * @param key - The key to encrypt the value with
   */
  abstract encryptString(plainValue: string, key: SymmetricCryptoKey): Promise<EncString>;
  /**
   * Encrypts bytes to an EncString
   * @param plainValue - The value to encrypt
   * @param key - The key to encrypt the value with
   * @deprecated Bytes are not the right abstraction to encrypt in. Use e.g. key wrapping or file encryption instead
   */
  abstract encryptBytes(plainValue: Uint8Array, key: SymmetricCryptoKey): Promise<EncString>;
  /**
   * Encrypts a value to a Uint8Array
   * @param plainValue - The value to encrypt
   * @param key - The key to encrypt the value with
   */
  abstract encryptFileData(
    plainValue: Uint8Array,
    key: SymmetricCryptoKey,
  ): Promise<EncArrayBuffer>;

  /**
   * Decrypts an EncString to a string
   * @throws IMPORTANT: This throws if decryption fails. If decryption failures are expected to happen,
   * the callsite should log where the failure occurred, and handle it by domain specifc logic (e.g. show a UI error).
   *
   * @param encString - The EncString containing the encrypted string.
   * @param key - The key to decrypt the value with
   * @returns The decrypted string
   * @throws Error if decryption fails
   */
  abstract decryptString(encString: EncString, key: SymmetricCryptoKey): Promise<string>;
  /**
   * Decrypts an EncString to a Uint8Array
   * @throws IMPORTANT: This throws if decryption fails. If decryption failures are expected to happen,
   * the callsite should log where the failure occurred, and handle it by domain specifc logic (e.g. show a UI error).
   *
   * @param encString - The EncString containing the encrypted bytes.
   * @param key - The key to decrypt the value with
   * @returns The decrypted bytes as a Uint8Array
   * @deprecated Bytes are not the right abstraction to encrypt in. Use e.g. key wrapping or file encryption instead
   */
  abstract decryptBytes(encString: EncString, key: SymmetricCryptoKey): Promise<Uint8Array>;
  /**
   * Decrypts an EncArrayBuffer to a Uint8Array
   * @param encBuffer - The EncArrayBuffer containing the encrypted file bytes.
   * @param key - The key to decrypt the value with
   * @returns The decrypted file bytes as a Uint8Array
   * @throws Error if decryption fails
   */
  abstract decryptFileData(encBuffer: EncArrayBuffer, key: SymmetricCryptoKey): Promise<Uint8Array>;

  /**
   * Wraps a decapsulation key (Private key) with a symmetric key
   * @see {@link https://en.wikipedia.org/wiki/Key_wrap}
   * @param decapsulationKeyPcks8 - The private key in PKCS8 format
   * @param wrappingKey - The symmetric key to wrap the private key with
   */
  abstract wrapDecapsulationKey(
    decapsulationKeyPcks8: Uint8Array,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<EncString>;
  /**
   * Wraps an encapsulation key (Public key) with a symmetric key
   * @see {@link https://en.wikipedia.org/wiki/Key_wrap}
   * @param encapsulationKeySpki - The public key in SPKI format
   * @param wrappingKey - The symmetric key to wrap the public key with
   */
  abstract wrapEncapsulationKey(
    encapsulationKeySpki: Uint8Array,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<EncString>;
  /**
   * Wraps a symmetric key with another symmetric key
   * @see {@link https://en.wikipedia.org/wiki/Key_wrap}
   * @param keyToBeWrapped - The symmetric key to wrap
   * @param wrappingKey - The symmetric key to wrap the encapsulated key with
   */
  abstract wrapSymmetricKey(
    keyToBeWrapped: SymmetricCryptoKey,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<EncString>;

  /**
   * Unwraps a decapsulation key (Private key) with a symmetric key
   * @see {@link https://en.wikipedia.org/wiki/Key_wrap}
   * @param decapsulationKeyPcks8 - The private key in PKCS8 format
   * @param wrappingKey - The symmetric key to wrap the private key with
   * @returns The unwrapped private key as a Uint8Array
   * @throws Error if unwrapping fails
   */
  abstract unwrapDecapsulationKey(
    wrappedDecapsulationKey: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<Uint8Array>;
  /**
   * Wraps an encapsulation key (Public key) with a symmetric key
   * @see {@link https://en.wikipedia.org/wiki/Key_wrap}
   * @param encapsulationKeySpki - The public key in SPKI format
   * @param wrappingKey - The symmetric key to wrap the public key with
   * @returns The unwrapped public key as a Uint8Array
   * @throws Error if unwrapping fails
   */
  abstract unwrapEncapsulationKey(
    wrappedEncapsulationKey: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<Uint8Array>;
  /**
   * Unwraps a symmetric key with another symmetric key
   * @see {@link https://en.wikipedia.org/wiki/Key_wrap}
   * @param keyToBeWrapped - The symmetric key to wrap
   * @param wrappingKey - The symmetric key to wrap the encapsulated key with
   * @returns The unwrapped symmetric key as a SymmetricCryptoKey
   * @throws Error if unwrapping fails
   */
  abstract unwrapSymmetricKey(
    keyToBeUnwrapped: EncString,
    wrappingKey: SymmetricCryptoKey,
  ): Promise<SymmetricCryptoKey>;

  /**
   * Encapsulates a symmetric key with an asymmetric public key
   * Note: This does not establish sender authenticity
   * @see {@link https://en.wikipedia.org/wiki/Key_encapsulation_mechanism}
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
   * @see {@link https://en.wikipedia.org/wiki/Key_encapsulation_mechanism}
   * @param encryptedSharedKey - The encrypted shared symmetric key
   * @param decapsulationKey - The key to decapsulate with (private key)
   * @return The decapsulated symmetric key
   * @throws Error if decapsulation fails
   */
  abstract decapsulateKeyUnsigned(
    encryptedSharedKey: EncString,
    decapsulationKey: Uint8Array,
  ): Promise<SymmetricCryptoKey>;

  /**
   * @deprecated Use @see {@link decapsulateKeyUnsigned} instead
   * @param data - The ciphertext to decrypt
   * @param privateKey - The privateKey to decrypt with
   */
  abstract rsaDecrypt(data: EncString, privateKey: Uint8Array): Promise<Uint8Array>;

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
