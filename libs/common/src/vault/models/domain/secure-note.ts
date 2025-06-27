// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { SecureNote as SdkSecureNote } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../platform/models/domain/symmetric-crypto-key";
import { SecureNoteType } from "../../enums";
import { SecureNoteData } from "../data/secure-note.data";
import { SecureNoteView } from "../view/secure-note.view";

export class SecureNote extends Domain {
  type: SecureNoteType;

  constructor(obj?: SecureNoteData) {
    super();
    if (obj == null) {
      return;
    }

    this.type = obj.type;
  }

  async decrypt(
    orgId: string,
    context = "No Cipher Context",
    encKey?: SymmetricCryptoKey,
  ): Promise<SecureNoteView> {
    return new SecureNoteView(this);
  }

  toSecureNoteData(): SecureNoteData {
    const n = new SecureNoteData();
    n.type = this.type;
    return n;
  }

  static fromJSON(obj: Jsonify<SecureNote>): SecureNote {
    if (obj == null) {
      return null;
    }

    return Object.assign(new SecureNote(), obj);
  }

  /**
   * Maps Secure note to SDK format.
   *
   * @returns {SdkSecureNote} The SDK secure note object.
   */
  toSdkSecureNote(): SdkSecureNote {
    return {
      type: this.type,
    };
  }

  /**
   * Maps an SDK SecureNote object to a SecureNote
   * @param obj - The SDK SecureNote object
   */
  static fromSdkSecureNote(obj: SdkSecureNote): SecureNote | undefined {
    if (obj == null) {
      return undefined;
    }

    const secureNote = new SecureNote();
    secureNote.type = obj.type;

    return secureNote;
  }
}
