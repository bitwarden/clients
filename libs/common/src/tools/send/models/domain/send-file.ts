// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import { SendFile as SdkSendFile } from "@bitwarden/sdk-internal";

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

  async decrypt(key: SymmetricCryptoKey): Promise<SendFileView> {
    return await this.decryptObj<SendFile, SendFileView>(
      this,
      new SendFileView(this),
      ["fileName"],
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

  /** Maps this domain `SendFile` to the SDK `SendFile` shape. */
  toSdk(): SdkSendFile {
    return {
      id: this.id ?? undefined,
      fileName: this.fileName?.toSdk(),
      size: this.size ?? undefined,
      sizeName: this.sizeName ?? undefined,
    };
  }

  /** Maps an SDK `SendFile` back to a domain `SendFile`. */
  static fromSdk(obj?: SdkSendFile): SendFile {
    if (obj == null) {
      return null;
    }

    return Object.assign(new SendFile(), {
      id: obj.id ?? null,
      fileName: EncString.fromJSON(obj.fileName),
      size: obj.size ?? null,
      sizeName: obj.sizeName ?? null,
    });
  }

  /** Serializes this domain `SendFile` to its `SendFileData` (string-shaped) form. */
  toSendData(): SendFileData {
    return Object.assign(new SendFileData(), {
      id: this.id ?? null,
      fileName: this.fileName?.toJSON() ?? null,
      size: this.size ?? null,
      sizeName: this.sizeName ?? null,
    });
  }
}
