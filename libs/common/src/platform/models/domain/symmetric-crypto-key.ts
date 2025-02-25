// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { CryptoClient, ExportedUserKey } from "@bitwarden/sdk-internal";

import { Utils } from "../../../platform/misc/utils";
import { EncryptionType } from "../../enums";

type Aes256CbcHmacKey = {
  type: EncryptionType.AesCbc256_HmacSha256_B64;
  encryptionKey: Uint8Array;
  authenticationKey: Uint8Array;
};

type Aes256CbcKey = {
  type: EncryptionType.AesCbc256_B64;
  encryptionKey: Uint8Array;
};

export class SymmetricCryptoKey {
  private key: Aes256CbcKey | Aes256CbcHmacKey;
  private newFormat = false;

  meta: any;

  constructor(key: Uint8Array) {
    if (key == null) {
      throw new Error("Must provide key");
    }

    if (key.byteLength === 32) {
      this.key = {
        type: EncryptionType.AesCbc256_B64,
        encryptionKey: key,
      }
    } else if (key.byteLength === 64) {
      this.key = {
        type: EncryptionType.AesCbc256_HmacSha256_B64,
        encryptionKey: key.slice(0, 32),
        authenticationKey: key.slice(32),
      }
    } else if (key.byteLength > 64) {
      this.newFormat = true;
      const decoded_key = CryptoClient.decode_userkey(key).Aes256CbcHmac;
      this.key = {
        type: EncryptionType.AesCbc256_HmacSha256_B64,
        encryptionKey: decoded_key.encryption_key,
        authenticationKey: decoded_key.authentication_key,
      }
    } else {
      throw new Error("Unable to determine encType.");
    }
  }

  getInnerKey(): Aes256CbcKey | Aes256CbcHmacKey {
    return this.key;
  }

  static fromString(s: string): SymmetricCryptoKey {
    if (s == null) {
      return null;
    }

    const arrayBuffer = Utils.fromB64ToArray(s);
    return new SymmetricCryptoKey(arrayBuffer);
  }

  // For test only
  toJSON() {
    const innerKey = this.getInnerKey();
    // The whole object is constructed from the initial key, so just store the B64 key
    if (innerKey.type === EncryptionType.AesCbc256_B64) {
      return { keyB64: Utils.fromBufferToB64(this.key.encryptionKey) };
    } else if (innerKey.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      return { keyB64: Utils.fromBufferToB64(new Uint8Array([...innerKey.encryptionKey, ...innerKey.authenticationKey])) };
    } else {
      throw new Error("Unsupported encryption type.");
    }
  }

  // For test only
  static fromJSON(obj: Jsonify<SymmetricCryptoKey>): SymmetricCryptoKey {
    return SymmetricCryptoKey.fromString(obj?.keyB64);
  }

  toSdkKey(): ExportedUserKey {
    if (this.key.type === EncryptionType.AesCbc256_B64) {
      throw new Error("Unsupported encryption type.");
    } else if (this.key.type === EncryptionType.AesCbc256_HmacSha256_B64) {
      return {
        Aes256CbcHmac: {
          encryption_key: this.key.encryptionKey,
          authentication_key: this.key.authenticationKey,
        },
      };
    } else {
      throw new Error("Unsupported encryption type.");
    }
  }

  toBase64(): string {
    return Utils.fromBufferToB64(this.toEncoded());
  }

  toEncoded(): Uint8Array {
    if (this.newFormat) {
      return CryptoClient.encode_userkey(this.toSdkKey());
    } else {
      if (this.key.type === EncryptionType.AesCbc256_B64) {
        return this.key.encryptionKey;
      } else if (this.key.type === EncryptionType.AesCbc256_HmacSha256_B64) {
        return new Uint8Array([...this.key.encryptionKey, ...this.key.authenticationKey]);
      } else {
        throw new Error("Unsupported encryption type.");
      }
    }
  }

  encryptionType(): EncryptionType {
    return this.key.type;
  }
}
