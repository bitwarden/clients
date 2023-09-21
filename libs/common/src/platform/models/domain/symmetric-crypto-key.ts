import { Jsonify, Opaque } from "type-fest";

import { EncryptionType } from "../../../enums";
import { Utils } from "../../../platform/misc/utils";

export class SymmetricCryptoKey {
  key: Uint8Array;
  encKey?: Uint8Array;
  macKey?: Uint8Array;
  encType: EncryptionType;

  keyB64: string;
  encKeyB64: string;
  macKeyB64: string;

  meta: any;

  constructor(key: Uint8Array, encType?: EncryptionType) {
    if (key == null) {
      throw new Error("Must provide key");
    }

    if (encType == null) {
      if (key.byteLength === 32) {
        encType = EncryptionType.AesCbc256_B64;
      } else if (key.byteLength === 64) {
        encType = EncryptionType.AesCbc256_HmacSha256_B64;
      } else {
        throw new Error("Unable to determine encType.");
      }
    }

    this.key = key;
    this.encType = encType;

    if (encType === EncryptionType.AesCbc256_B64 && key.byteLength === 32) {
      this.encKey = key;
      this.macKey = null;
    } else if (encType === EncryptionType.AesCbc128_HmacSha256_B64 && key.byteLength === 32) {
      this.encKey = key.slice(0, 16);
      this.macKey = key.slice(16, 32);
    } else if (encType === EncryptionType.AesCbc256_HmacSha256_B64 && key.byteLength === 64) {
      this.encKey = key.slice(0, 32);
      this.macKey = key.slice(32, 64);
    } else {
      throw new Error("Unsupported encType/key length.");
    }

    if (this.key != null) {
      this.keyB64 = Utils.fromBufferToB64(this.key);
    }
    if (this.encKey != null) {
      this.encKeyB64 = Utils.fromBufferToB64(this.encKey);
    }
    if (this.macKey != null) {
      this.macKeyB64 = Utils.fromBufferToB64(this.macKey);
    }
  }

  toJSON() {
    // The whole object is constructed from the initial key, so just store the B64 key
    return { keyB64: this.keyB64 };
  }

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

// Setup all separate key types as opaque types
export type DeviceKey = Opaque<SymmetricCryptoKey, "DeviceKey">;
export type UserKey = Opaque<SymmetricCryptoKey, "UserKey">;
export type MasterKey = Opaque<SymmetricCryptoKey, "MasterKey">;
export type PinKey = Opaque<SymmetricCryptoKey, "PinKey">;
export type OrgKey = Opaque<SymmetricCryptoKey, "OrgKey">;
export type ProviderKey = Opaque<SymmetricCryptoKey, "ProviderKey">;
