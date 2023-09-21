import { Jsonify, Opaque } from "type-fest";

import { EncryptionType, EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE } from "../../../enums";
import { Utils } from "../../../platform/misc/utils";
import { Encrypted } from "../../interfaces/encrypted";

import { SymmetricCryptoKey } from "./symmetric-crypto-key";

export class EncString implements Encrypted {
  encryptedString?: EncryptedString;
  encryptionType?: EncryptionType;
  decryptedValue?: string;
  data?: string;
  iv?: string;
  mac?: string;

  constructor(
    encryptedStringOrType: string | EncryptionType,
    data?: string,
    iv?: string,
    mac?: string
  ) {
    if (data != null) {
      this.initFromData(encryptedStringOrType as EncryptionType, data, iv, mac);
    } else {
      this.initFromEncryptedString(encryptedStringOrType as string);
    }
  }

  get ivBytes(): Uint8Array {
    return this.iv == null ? null : Utils.fromB64ToArray(this.iv);
  }

  get macBytes(): Uint8Array {
    return this.mac == null ? null : Utils.fromB64ToArray(this.mac);
  }

  get dataBytes(): Uint8Array {
    return this.data == null ? null : Utils.fromB64ToArray(this.data);
  }

  toJSON() {
    return this.encryptedString;
  }

  static fromJSON(obj: Jsonify<EncString>): EncString {
    if (obj == null) {
      return null;
    }

    return new EncString(obj);
  }

  private initFromData(encType: EncryptionType, data: string, iv: string, mac: string) {
    if (iv != null) {
      this.encryptedString = (encType + "." + iv + "|" + data) as EncryptedString;
    } else {
      this.encryptedString = (encType + "." + data) as EncryptedString;
    }

    // mac
    if (mac != null) {
      this.encryptedString = (this.encryptedString + "|" + mac) as EncryptedString;
    }

    this.encryptionType = encType;
    this.data = data;
    this.iv = iv;
    this.mac = mac;
  }

  private initFromEncryptedString(encryptedString: string) {
    this.encryptedString = encryptedString as EncryptedString;
    if (!this.encryptedString) {
      return;
    }

    const { encType, encPieces } = EncString.parseEncryptedString(this.encryptedString);
    this.encryptionType = encType;

    if (encPieces.length !== EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE[encType]) {
      return;
    }

    switch (encType) {
      case EncryptionType.AesCbc128_HmacSha256_B64:
      case EncryptionType.AesCbc256_HmacSha256_B64:
        this.iv = encPieces[0];
        this.data = encPieces[1];
        this.mac = encPieces[2];
        break;
      case EncryptionType.AesCbc256_B64:
        this.iv = encPieces[0];
        this.data = encPieces[1];
        break;
      case EncryptionType.Rsa2048_OaepSha256_B64:
      case EncryptionType.Rsa2048_OaepSha1_B64:
        this.data = encPieces[0];
        break;
      default:
        return;
    }
  }

  private static parseEncryptedString(encryptedString: string): {
    encType: EncryptionType;
    encPieces: string[];
  } {
    const headerPieces = encryptedString.split(".");
    let encType: EncryptionType;
    let encPieces: string[] = null;

    if (headerPieces.length === 2) {
      try {
        encType = parseInt(headerPieces[0], null);
        encPieces = headerPieces[1].split("|");
      } catch (e) {
        return;
      }
    } else {
      encPieces = encryptedString.split("|");
      encType =
        encPieces.length === 3
          ? EncryptionType.AesCbc128_HmacSha256_B64
          : EncryptionType.AesCbc256_B64;
    }

    return {
      encType,
      encPieces,
    };
  }

  static isSerializedEncString(s: string): boolean {
    const { encType, encPieces } = this.parseEncryptedString(s);

    return EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE[encType] === encPieces.length;
  }

  async decrypt(orgId: string, key: SymmetricCryptoKey = null): Promise<string> {
    if (this.decryptedValue != null) {
      return this.decryptedValue;
    }

    try {
      if (key == null) {
        key = await this.getKeyForDecryption(orgId);
      }
      if (key == null) {
        throw new Error("No key to decrypt EncString with orgId " + orgId);
      }

      const encryptService = Utils.getContainerService().getEncryptService();
      this.decryptedValue = await encryptService.decryptToUtf8(this, key);
    } catch (e) {
      this.decryptedValue = "[error: cannot decrypt]";
    }
    return this.decryptedValue;
  }

  private async getKeyForDecryption(orgId: string) {
    const cryptoService = Utils.getContainerService().getCryptoService();
    return orgId != null
      ? await cryptoService.getOrgKey(orgId)
      : await cryptoService.getUserKeyWithLegacySupport();
  }
}

export type EncryptedString = Opaque<string, "EncString">;
