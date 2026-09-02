// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";
import { SendView as SdkSendView } from "@bitwarden/sdk-internal";

import { View } from "../../../../models/view/view";
import { uuidAsString } from "../../../../platform/abstractions/sdk/sdk.service";
import { Utils } from "../../../../platform/misc/utils";
import { DeepJsonify } from "../../../../types/deep-jsonify";
import { AuthType } from "../../types/auth-type";
import { SendType } from "../../types/send-type";
import { AUTH_TYPE_FROM_SDK, Send, SEND_TYPE_FROM_SDK } from "../domain/send";

import { SendFileView } from "./send-file.view";
import { SendItemView } from "./send-item.view";
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
  data = new SendItemView();
  maxAccessCount?: number = null;
  accessCount = 0;
  revisionDate: Date = null;
  deletionDate: Date = null;
  expirationDate: Date = null;
  password: string = null;
  emails: string[] = [];
  disabled = false;
  hideEmail = false;
  authType: AuthType = null;

  constructor(s?: Send) {
    if (!s) {
      return;
    }

    this.id = s.id;
    this.accessId = s.accessId;
    this.type = s.type;
    this.authType = s.authType;
    this.maxAccessCount = s.maxAccessCount;
    this.accessCount = s.accessCount;
    this.revisionDate = s.revisionDate;
    this.deletionDate = s.deletionDate;
    this.expirationDate = s.expirationDate;
    this.disabled = s.disabled;
    this.password = s.password;
    this.hideEmail = s.hideEmail;
    this.authType = s.authType;
  }

  get urlB64Key(): string {
    return Utils.fromArrayToUrlB64(this.key);
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
      data: SendItemView.fromJSON(json.data),
      revisionDate: json.revisionDate == null ? null : new Date(json.revisionDate),
      deletionDate: json.deletionDate == null ? null : new Date(json.deletionDate),
      expirationDate: json.expirationDate == null ? null : new Date(json.expirationDate),
    });
  }

  /** Maps an SDK `SendView` back to a domain `SendView`. */
  static fromSdkSend(obj?: SdkSendView): SendView {
    if (obj == null) {
      return null;
    }
    const send = new SendView();
    send.id = obj.id ? uuidAsString(obj.id) : null;
    send.accessId = obj.accessId ?? null;
    send.name = obj.name;
    send.notes = obj.notes;
    send.key = Utils.fromUrlB64ToArray(obj.key);
    send.type = SEND_TYPE_FROM_SDK[obj.type];
    send.maxAccessCount = obj.maxAccessCount ?? undefined;
    send.accessCount = obj.accessCount;
    send.disabled = obj.disabled;
    send.hideEmail = obj.hideEmail;
    send.revisionDate = obj.revisionDate != null ? new Date(obj.revisionDate) : null;
    send.deletionDate = obj.deletionDate != null ? new Date(obj.deletionDate) : null;
    send.expirationDate = obj.expirationDate != null ? new Date(obj.expirationDate) : null;
    send.emails = obj.emails ?? null;
    send.authType = AUTH_TYPE_FROM_SDK[obj.authType];
    send.text = obj.text != null ? SendTextView.fromSdk(obj.text) : null;
    send.file = obj.file != null ? SendFileView.fromSdk(obj.file) : null;
    send.data = obj.data != null ? SendItemView.fromSdk(obj.data) : null;
    return send;
  }
}
