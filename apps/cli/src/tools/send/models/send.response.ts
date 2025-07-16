// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SendType } from "@bitwarden/common/tools/send/enums/send-type";
import { SendView } from "@bitwarden/common/tools/send/models/view/send.view";

import { BaseResponse } from "../../../models/response/base.response";

import { SendFileResponse } from "./send-file.response";
import { SendTextResponse } from "./send-text.response";

const dateProperties: string[] = [
  Utils.nameOf<SendResponse>("deletionDate"),
  Utils.nameOf<SendResponse>("expirationDate"),
];

export class SendResponse implements BaseResponse {
  static template(sendType?: SendType, deleteInDays = 7): SendResponse {
    const req = new SendResponse();
    req.name = "Send name";
    req.notes = "Some notes about this send.";
    req.type = sendType === SendType.File ? SendType.File : SendType.Text;
    req.text = sendType === SendType.Text ? SendTextResponse.template() : null;
    req.file = sendType === SendType.File ? SendFileResponse.template() : null;
    req.maxAccessCount = null;
    req.deletionDate = this.getStandardDeletionDate(deleteInDays);
    req.expirationDate = null;
    req.password = null;
    req.emails = null;
    req.disabled = false;
    req.hideEmail = false;
    return req;
  }

  static toView(send: SendResponse, view = new SendView()): SendView {
    if (send == null) {
      return null;
    }

    view.id = send.id;
    view.accessId = send.accessId;
    view.name = send.name;
    view.notes = send.notes;
    view.key = send.key == null ? null : Utils.fromB64ToArray(send.key);
    view.type = send.type;
    view.file = SendFileResponse.toView(send.file);
    view.text = SendTextResponse.toView(send.text);
    view.maxAccessCount = send.maxAccessCount;
    view.accessCount = send.accessCount;
    view.revisionDate = send.revisionDate;
    view.deletionDate = send.deletionDate;
    view.expirationDate = send.expirationDate;
    view.password = send.password;
    view.emails = send.emails ?? [];
    view.disabled = send.disabled;
    view.hideEmail = send.hideEmail;
    return view;
  }

  static fromJson(json: string) {
    return JSON.parse(json, (key, value) => {
      if (dateProperties.includes(key)) {
        return value == null ? null : new Date(value);
      }
      return value;
    });
  }

  private static getStandardDeletionDate(days: number) {
    const d = new Date();
    d.setTime(d.getTime() + days * 86400000); // ms per day
    return d;
  }

  object = "send";
  id: string;
  accessId: string;
  accessUrl: string;
  name: string;
  notes: string;
  key: string;
  type: SendType;
  text: SendTextResponse;
  file: SendFileResponse;
  maxAccessCount?: number;
  accessCount: number;
  revisionDate: Date;
  deletionDate: Date;
  expirationDate: Date;
  password: string;
  passwordSet: boolean;
  emails?: Array<string>;
  disabled: boolean;
  hideEmail: boolean;

  constructor(o?: SendView, webVaultUrl?: string) {
    if (o == null) {
      return;
    }
    this.id = o.id;
    this.accessId = o.accessId;
    let sendLinkBaseUrl = webVaultUrl;
    if (sendLinkBaseUrl == null) {
      sendLinkBaseUrl = "https://send.bitwarden.com/#";
    } else {
      sendLinkBaseUrl += "/#/send/";
    }
    this.accessUrl = sendLinkBaseUrl + this.accessId + "/" + o.urlB64Key;
    this.name = o.name;
    this.notes = o.notes;
    this.key = Utils.fromBufferToB64(o.key);
    this.type = o.type;
    this.maxAccessCount = o.maxAccessCount;
    this.accessCount = o.accessCount;
    this.revisionDate = o.revisionDate;
    this.deletionDate = o.deletionDate;
    this.expirationDate = o.expirationDate;
    this.passwordSet = o.password != null;
    this.disabled = o.disabled;
    this.hideEmail = o.hideEmail;

    if (o.type === SendType.Text && o.text != null) {
      this.text = new SendTextResponse(o.text);
    }
    if (o.type === SendType.File && o.file != null) {
      this.file = new SendFileResponse(o.file);
    }
  }
}
