// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendType } from "../../enums/send-type";
import { SendResponse } from "../response/send.response";

import { SendFileData } from "./send-file.data";
import { SendTextData } from "./send-text.data";

export class SendData {
  id: string;
  accessId: string;
  type: SendType;
  name: string;
  notes: string;
  file: SendFileData;
  text: SendTextData;
  key: string;
  maxAccessCount?: number;
  accessCount: number;
  revisionDate: string;
  expirationDate: string;
  deletionDate: string;
  password: string;
  disabled: boolean;
  hideEmail: boolean;

  constructor(response?: SendResponse) {
    if (response == null) {
      return;
    }

    this.id = response.id;
    this.accessId = response.accessId;
    this.type = response.type;
    this.name = response.name;
    this.notes = response.notes;
    this.key = response.key;
    this.maxAccessCount = response.maxAccessCount;
    this.accessCount = response.accessCount;
    this.revisionDate = response.revisionDate;
    this.expirationDate = response.expirationDate;
    this.deletionDate = response.deletionDate;
    this.password = response.password;
    this.disabled = response.disable;
    this.hideEmail = response.hideEmail;

    switch (this.type) {
      case SendType.Text:
        this.text = new SendTextData(response.text);
        break;
      case SendType.File:
        this.file = new SendFileData(response.file);
        break;
      default:
        break;
    }
  }
}
