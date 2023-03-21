import { Jsonify } from "type-fest";

import { SecureNoteType } from "../../../enums/secureNoteType";
import Domain from "../../../models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../models/domain/symmetric-crypto-key";
import { Guid } from "../../../types/guid";
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

  decrypt(orgId: Guid, encKey?: SymmetricCryptoKey): Promise<SecureNoteView> {
    return Promise.resolve(new SecureNoteView(this));
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
}
