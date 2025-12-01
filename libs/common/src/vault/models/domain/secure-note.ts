import { Jsonify } from "type-fest";

import { SecureNote as SdkSecureNote } from "@bitwarden/sdk-internal";

import Domain from "../../../platform/models/domain/domain-base";
import { SecureNoteType } from "../../enums";
import { SecureNoteData } from "../data/secure-note.data";
import { SecureNoteView } from "../view/secure-note.view";

export class SecureNote extends Domain {
  type: SecureNoteType = SecureNoteType.Generic;

  constructor(obj?: SecureNoteData) {
    super();
    if (obj == null) {
      return;
    }

    this.type = obj.type;
  }

  async decrypt(): Promise<SecureNoteView> {
    return new SecureNoteView(this);
  }

  toSecureNoteData(): SecureNoteData {
    const n = new SecureNoteData();
    n.type = this.type;
    return n;
  }

  static fromJSON(obj: Jsonify<SecureNote> | undefined): SecureNote | undefined {
    if (obj == null) {
      return undefined;
    }

    const secureNote = new SecureNote();
    secureNote.type = obj.type;
    return secureNote;
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
  static fromSdkSecureNote(obj?: SdkSecureNote): SecureNote | undefined {
    if (obj == null) {
      return undefined;
    }

    const secureNote = new SecureNote();
    secureNote.type = obj.type;

    return secureNote;
  }
}
