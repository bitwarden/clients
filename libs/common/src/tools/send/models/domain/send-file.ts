// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import Domain from "../../../../platform/models/domain/domain-base";
import { EncString } from "../../../../platform/models/domain/enc-string";
import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { SendFileData } from "../data/send-file.data";
import { SendFileView } from "../view/send-file.view";

export class SendFile extends Domain {
  id: string;
  size: string;
  sizeName: string;
  fileName: EncString;

  constructor(obj?: SendFileData) {
    super();
    if (obj == null) {
      return;
    }

    this.size = obj.size;
    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        sizeName: null,
        fileName: null,
      },
      ["id", "sizeName"],
    );
  }

  async decrypt(key: SymmetricCryptoKey): Promise<SendFileView> {
    const view = await this.decryptObj(
      new SendFileView(this),
      {
        fileName: null,
      },
      null,
      key,
    );
    return view;
  }

  static fromJSON(obj: Jsonify<SendFile>) {
    if (obj == null) {
      return null;
    }

    return Object.assign(new SendFile(), obj, {
      fileName: EncString.fromJSON(obj.fileName),
    });
  }
}
