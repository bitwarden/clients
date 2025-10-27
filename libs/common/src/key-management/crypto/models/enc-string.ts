// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString as SdkEncString } from "@bitwarden/sdk-internal";

import { EncryptionType, EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE } from "../../../platform/enums";

export const DECRYPT_ERROR = "[error: cannot decrypt]";

export class EncString {
  encryptedString?: SdkEncString;
  encryptionType?: EncryptionType;
  decryptedValue?: string;
  data?: string;
  iv?: string;
  mac?: string;

  constructor(
    encryptedStringOrType: string | EncryptionType,
    data?: string,
    iv?: string,
    mac?: string,
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

  toSdk(): SdkEncString {
    return this.encryptedString;
  }

  toJSON(): string {
    return this.encryptedString as string;
  }

  static fromJSON(obj: Jsonify<EncString>): EncString {
    if (obj == null) {
      return null;
    }

    return new EncString(obj);
  }

  private initFromData(encType: EncryptionType, data: string, iv: string, mac: string) {
    if (iv != null) {
      this.encryptedString = (encType + "." + iv + "|" + data) as SdkEncString;
    } else {
      this.encryptedString = (encType + "." + data) as SdkEncString;
    }

    // mac
    if (mac != null) {
      this.encryptedString = (this.encryptedString + "|" + mac) as SdkEncString;
    }

    this.encryptionType = encType;
    this.data = data;
    this.iv = iv;
    this.mac = mac;
  }

  private initFromEncryptedString(encryptedString: string) {
    this.encryptedString = encryptedString as SdkEncString;
    if (!this.encryptedString) {
      return;
    }

    const { encType, encPieces } = EncString.parseEncryptedString(this.encryptedString);

    this.encryptionType = encType;

    if (encPieces.length !== EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE[encType]) {
      return;
    }

    switch (encType) {
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
      case EncryptionType.Rsa2048_OaepSha256_HmacSha256_B64:
      case EncryptionType.Rsa2048_OaepSha1_HmacSha256_B64:
        this.data = encPieces[0];
        this.mac = encPieces[1];
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
        // FIXME: Remove when updating file. Eslint update
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        return { encType: NaN, encPieces: [] };
      }
    } else {
      encPieces = encryptedString.split("|");
      encType = EncryptionType.AesCbc256_B64;
    }

    return {
      encType,
      encPieces,
    };
  }

  static isSerializedEncString(s: string): boolean {
    if (s == null) {
      return false;
    }

    const { encType, encPieces } = this.parseEncryptedString(s);

    if (isNaN(encType) || encPieces.length === 0) {
      return false;
    }

    return EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE[encType] === encPieces.length;
  }
}

/**
 * Temporary type mapping until consumers are moved over.
 * @deprecated - Use SdkEncString directly
 */
export type EncryptedString = SdkEncString;
