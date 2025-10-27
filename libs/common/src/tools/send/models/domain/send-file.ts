// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { UserId } from "@bitwarden/user-core";

import { EncString } from "../../../../key-management/crypto/models/enc-string";
import Domain from "../../../../platform/models/domain/domain-base";
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

  async decrypt(userId: UserId, key: SymmetricCryptoKey): Promise<SendFileView> {
    return await this.decryptObj<SendFile, SendFileView>(
      this,
      new SendFileView(this),
      ["fileName"],
      userId,
      null,
      key,
    );
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
