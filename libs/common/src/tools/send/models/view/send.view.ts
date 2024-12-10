// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { View } from "../../../../models/view/view";
import { Utils } from "../../../../platform/misc/utils";
import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { DeepJsonify } from "../../../../types/deep-jsonify";
import { SendType } from "../../enums/send-type";
import { Send } from "../domain/send";

import { SendFileView } from "./send-file.view";
import { SendTextView } from "./send-text.view";

export class SendView implements View {
  id: string = null;
  accessId: string = null;
  name: string = null;
  notes: string = null;
  key: Uint8Array;
  cryptoKey: SymmetricCryptoKey;
  type: SendType = null;
  text = new SendTextView();
  file = new SendFileView();
  maxAccessCount?: number = null;
  accessCount = 0;
  revisionDate: Date = null;
  deletionDate: Date = null;
  expirationDate: Date = null;
  password: string = null;
  disabled = false;
  hideEmail = false;

  constructor(s?: Send) {
    if (!s) {
      return;
    }

    this.id = s.id;
    this.accessId = s.accessId;
    this.type = s.type;
    this.maxAccessCount = s.maxAccessCount;
    this.accessCount = s.accessCount;
    this.revisionDate = s.revisionDate;
    this.deletionDate = s.deletionDate;
    this.expirationDate = s.expirationDate;
    this.disabled = s.disabled;
    this.password = s.password;
    this.hideEmail = s.hideEmail;
  }

  get urlB64Key(): string {
    return Utils.fromBufferToUrlB64(this.key);
  }

  get maxAccessCountReached(): boolean {
    if (this.maxAccessCount == null) {
      return false;
    }
    return this.accessCount >= this.maxAccessCount;
  }

  get expired(): boolean {
    if (this.expirationDate == null) {
      return false;
    }
    return this.expirationDate <= new Date();
  }

  get pendingDelete(): boolean {
    return this.deletionDate <= new Date();
  }

  toJSON() {
    return Utils.merge(
      { ...this },
      {
        key: Utils.fromBufferToB64(this.key),
      },
    );
  }

  static fromJSON(json: DeepJsonify<SendView>) {
    if (json == null) {
      return null;
    }

    return Object.assign(new SendView(), json, {
      key: Utils.fromB64ToArray(json.key),
      cryptoKey: SymmetricCryptoKey.fromJSON(json.cryptoKey),
      text: SendTextView.fromJSON(json.text),
      file: SendFileView.fromJSON(json.file),
      revisionDate: json.revisionDate == null ? null : new Date(json.revisionDate),
      deletionDate: json.deletionDate == null ? null : new Date(json.deletionDate),
      expirationDate: json.expirationDate == null ? null : new Date(json.expirationDate),
    });
  }
}
