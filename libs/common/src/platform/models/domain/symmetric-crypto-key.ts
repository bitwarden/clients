// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Utils } from "../../../platform/misc/utils";
import { EncryptionType } from "../../enums";

export type Aes256CbcHmacKey = {
  type: EncryptionType.AesCbc256_HmacSha256_B64;
  encryptionKey: Uint8Array;
  authenticationKey: Uint8Array;
};

export type Aes256CbcKey = {
  type: EncryptionType.AesCbc256_B64;
  encryptionKey: Uint8Array;
};

export type CoseKey = {
  type: EncryptionType.CoseEncrypt0;
  // Encryption key here refers to the cose-encoded and padded key. This MAY later be refactored to contain the actual key bytes, as is the case in the SDK
  encryptionKey: Uint8Array;
};

/**
 *  A symmetric crypto key represents a symmetric key usable for symmetric encryption and decryption operations.
 *  The specific algorithm used is private to the key, and should only be exposed to encrypt service implementations.
 *  This can be done via `inner()`.
 */
export class SymmetricCryptoKey {
  private innerKey: Aes256CbcHmacKey | Aes256CbcKey | CoseKey;

  keyB64: string;

  /**
   * @param key The key in one of the permitted serialization formats
   */
  constructor(key: Uint8Array) {
    if (key == null) {
      throw new Error("Must provide key");
    }

    if (key.byteLength === 32) {
      this.innerKey = {
        type: EncryptionType.AesCbc256_B64,
        encryptionKey: key,
      };
      this.keyB64 = this.toBase64();
    } else if (key.byteLength === 64) {
      this.innerKey = {
        type: EncryptionType.AesCbc256_HmacSha256_B64,
        encryptionKey: key.slice(0, 32),
        authenticationKey: key.slice(32),
      };
      this.keyB64 = this.toBase64();
    } else if (key.byteLength > 64) {
      this.innerKey = {
        type: EncryptionType.CoseEncrypt0,
        encryptionKey: key,
      };
      this.keyB64 = this.toBase64();
    } else {
      throw new Error(`Unsupported encType/key length ${key.byteLength}`);
    }
  }

  toJSON() {
    // The whole object is constructed from the initial key, so just store the B64 key
    return { keyB64: this.keyB64 };
  }

  /**
   * It is preferred not to work with the raw key where possible.
   * Only use this method if absolutely necessary.
   *
   * @returns The inner key instance that can be directly used for encryption primitives
   */
  inner(): Aes256CbcHmacKey | Aes256CbcKey | CoseKey {
    return this.innerKey;
  }

  /**
   * @returns The serialized key in base64 format
   */
  toBase64(): string {
    return Utils.fromBufferToB64(this.toEncoded());
  }

  /**
   * Serializes the key to a format that can be written to state or shared
   * The currently permitted format is:
   * - AesCbc256_B64: 32 bytes (the raw key)
   * - AesCbc256_HmacSha256_B64: 64 bytes (32 bytes encryption key, 32 bytes authentication key, concatenated)
   *
   * @returns The serialized key that can be written to state or encrypted and then written to state / shared
   */
  toEncoded(): Uint8Array {
    if (this.innerKey.type === EncryptionType.AesCbc256_B64) {
      return this.innerKey.encryptionKey;
    } else if (this.innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      const encodedKey = new Uint8Array(64);
      encodedKey.set(this.innerKey.encryptionKey, 0);
      encodedKey.set(this.innerKey.authenticationKey, 32);
      return encodedKey;
    } else if (this.innerKey.type === EncryptionType.CoseEncrypt0) {
      return this.innerKey.encryptionKey;
    } else {
      throw new Error("Unsupported encryption type.");
    }
  }

  /**
   * @param s The serialized key in base64 format
   * @returns A SymmetricCryptoKey instance
   */
  static fromString(s: string): SymmetricCryptoKey {
    if (s == null) {
      return null;
    }

    const arrayBuffer = Utils.fromB64ToArray(s);
    return new SymmetricCryptoKey(arrayBuffer);
  }

  static fromJSON(obj: Jsonify<SymmetricCryptoKey>): SymmetricCryptoKey {
    return SymmetricCryptoKey.fromString(obj?.keyB64);
  }
}
