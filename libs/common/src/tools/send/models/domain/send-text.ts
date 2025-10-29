// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { EncString } from "../../../../key-management/crypto/models/enc-string";
import Domain from "../../../../platform/models/domain/domain-base";
import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { SendTextData } from "../data/send-text.data";
import { SendTextView } from "../view/send-text.view";

export class SendText extends Domain {
  text: EncString;
  hidden: boolean;

  constructor(obj?: SendTextData) {
    super();
    if (obj == null) {
      return;
    }

    this.hidden = obj.hidden;
    this.buildDomainModel(
      this,
      obj,
      {
        text: null,
      },
      [],
    );
  }

  decrypt(key: SymmetricCryptoKey): Promise<SendTextView> {
    return this.decryptObj<SendText, SendTextView>(
      this,
      new SendTextView(this),
      ["text"],
      null,
      key,
      null,
    );
  }

  static fromJSON(obj: Jsonify<SendText>) {
    if (obj == null) {
      return null;
    }

    return Object.assign(new SendText(), obj, {
      text: EncString.fromJSON(obj.text),
    });
  }
}
