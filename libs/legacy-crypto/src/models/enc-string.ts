// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncString as SdkEncString } from "@bitwarden/sdk-internal";

import {
  EncryptionType,
  EXPECTED_NUM_PARTS_BY_ENCRYPTION_TYPE,
} from "../enums/encryption-type.enum";

export const DECRYPT_ERROR = "[error: cannot decrypt]";

export class EncString {
  encryptedString?: SdkEncString;

  constructor(encryptedString: string) {
    this.encryptedString = encryptedString as SdkEncString;
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
