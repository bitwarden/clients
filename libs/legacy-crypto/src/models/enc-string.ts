// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncString as SdkEncString } from "@bitwarden/sdk-internal";

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
}

/**
 * Temporary type mapping until consumers are moved over.
 * @deprecated - Use SdkEncString directly
 */
export type EncryptedString = SdkEncString;
