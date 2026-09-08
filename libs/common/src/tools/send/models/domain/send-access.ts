// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// eslint-disable-next-line no-restricted-imports
import { EncString, SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import Domain from "../../../../platform/models/domain/domain-base";
import { SendType } from "../../types/send-type";
import { SendAccessResponse } from "../response/send-access.response";
import { SendAccessView } from "../view/send-access.view";

import { SendFile } from "./send-file";
import { SendItem } from "./send-item";
import { SendText } from "./send-text";

export class SendAccess extends Domain {
  id: string;
  type: SendType;
  name: EncString;
  file: SendFile;
  text: SendText;
  data: SendItem;
  expirationDate: Date;
  creatorIdentifier: string;

  constructor(obj?: SendAccessResponse) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        name: null,
        expirationDate: null,
        creatorIdentifier: null,
      },
      ["id", "expirationDate", "creatorIdentifier"],
    );

    this.type = obj.type;

    switch (this.type) {
      case SendType.Text:
        this.text = new SendText(obj.text);
        break;
      case SendType.File:
        this.file = new SendFile(obj.file);
        break;
      case SendType.Item:
        this.data = new SendItem(obj.data);
        break;
      default:
        break;
    }
  }

  async decrypt(key: SymmetricCryptoKey): Promise<SendAccessView> {
    if (this.type === SendType.Item) {
      throw new Error("Item type Sends require the SDK to decrypt");
    }

    const model = new SendAccessView(this);

    await this.decryptObj<SendAccess, SendAccessView>(this, model, ["name"], key);

    switch (this.type) {
      case SendType.File:
        model.file = await this.file.decrypt(key);
        break;
      case SendType.Text:
        model.text = await this.text.decrypt(key);
        break;
      default:
        break;
    }

    return model;
  }
}
