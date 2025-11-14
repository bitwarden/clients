// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { firstValueFrom } from "rxjs";
import { Jsonify } from "type-fest";

import { UserId } from "@bitwarden/common/types/guid";

import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { Utils } from "../../../../platform/misc/utils";
import Domain from "../../../../platform/models/domain/domain-base";
import { SendType } from "../../enums/send-type";
import { SendData } from "../data/send.data";
import { SendView } from "../view/send.view";

import { SendFile } from "./send-file";
import { SendText } from "./send-text";

export class Send extends Domain {
  id: string;
  accessId: string;
  type: SendType;
  name: EncString;
  notes: EncString;
  file: SendFile;
  text: SendText;
  key: EncString;
  maxAccessCount?: number;
  accessCount: number;
  revisionDate: Date;
  expirationDate: Date;
  deletionDate: Date;
  password: string;
  emails: string;
  disabled: boolean;
  hideEmail: boolean;

  constructor(obj?: SendData) {
    super();
    if (obj == null) {
      return;
    }

    this.buildDomainModel(
      this,
      obj,
      {
        id: null,
        accessId: null,
        name: null,
        notes: null,
        key: null,
      },
      ["id", "accessId"],
    );

    this.type = obj.type;
    this.maxAccessCount = obj.maxAccessCount;
    this.accessCount = obj.accessCount;
    this.password = obj.password;
    this.emails = obj.emails;
    this.disabled = obj.disabled;
    this.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
    this.deletionDate = obj.deletionDate != null ? new Date(obj.deletionDate) : null;
    this.expirationDate = obj.expirationDate != null ? new Date(obj.expirationDate) : null;
    this.hideEmail = obj.hideEmail;

    switch (this.type) {
      case SendType.Text:
        this.text = new SendText(obj.text);
        break;
      case SendType.File:
        this.file = new SendFile(obj.file);
        break;
      default:
        break;
    }
  }

  async decrypt(userId: UserId): Promise<SendView> {
    if (!userId) {
      throw new Error("User ID must not be null or undefined");
    }

    const model = new SendView(this);
    const keyService = Utils.getContainerService().getKeyService();
    const encryptService = Utils.getContainerService().getEncryptService();
    const sendKeyEncryptionKey = await firstValueFrom(keyService.userKey$(userId));
    // model.key is a seed used to derive a key, not a SymmetricCryptoKey
    model.key = await encryptService.decryptBytes(this.key, sendKeyEncryptionKey);
    model.cryptoKey = await keyService.makeSendKey(model.key);

    await this.decryptObj<Send, SendView>(this, model, ["name", "notes"], null, model.cryptoKey);

    switch (this.type) {
      case SendType.File:
        model.file = await this.file.decrypt(model.cryptoKey);
        break;
      case SendType.Text:
        model.text = await this.text.decrypt(model.cryptoKey);
        break;
      default:
        break;
    }

    return model;
  }

  static fromJSON(obj: Jsonify<Send>) {
    if (obj == null) {
      return null;
    }

    const revisionDate = obj.revisionDate == null ? null : new Date(obj.revisionDate);
    const expirationDate = obj.expirationDate == null ? null : new Date(obj.expirationDate);
    const deletionDate = obj.deletionDate == null ? null : new Date(obj.deletionDate);

    return Object.assign(new Send(), obj, {
      key: EncString.fromJSON(obj.key),
      name: EncString.fromJSON(obj.name),
      notes: EncString.fromJSON(obj.notes),
      text: SendText.fromJSON(obj.text),
      file: SendFile.fromJSON(obj.file),
      revisionDate,
      expirationDate,
      deletionDate,
    });
  }
}
