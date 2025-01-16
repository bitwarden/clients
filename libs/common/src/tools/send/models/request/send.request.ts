// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendType } from "../../enums/send-type";
import { SendFileApi } from "../api/send-file.api";
import { SendTextApi } from "../api/send-text.api";
import { Send } from "../domain/send";

export class SendRequest {
  type: SendType;
  fileLength?: number;
  name: string;
  notes: string;
  key: string;
  maxAccessCount?: number;
  expirationDate: string;
  deletionDate: string;
  text: SendTextApi;
  file: SendFileApi;
  password: string;
  disabled: boolean;
  hideEmail: boolean;

  constructor(send: Send, fileLength?: number) {
    this.type = send.type;
    this.fileLength = fileLength;
    this.name = send.name ? send.name.encryptedString : null;
    this.notes = send.notes ? send.notes.encryptedString : null;
    this.maxAccessCount = send.maxAccessCount;
    this.expirationDate = send.expirationDate != null ? send.expirationDate.toISOString() : null;
    this.deletionDate = send.deletionDate != null ? send.deletionDate.toISOString() : null;
    this.key = send.key != null ? send.key.encryptedString : null;
    this.password = send.password;
    this.disabled = send.disabled;
    this.hideEmail = send.hideEmail;

    switch (this.type) {
      case SendType.Text:
        this.text = new SendTextApi();
        this.text.text = send.text.text != null ? send.text.text.encryptedString : null;
        this.text.hidden = send.text.hidden;
        break;
      case SendType.File:
        this.file = new SendFileApi();
        this.file.fileName = send.file.fileName != null ? send.file.fileName.encryptedString : null;
        break;
      default:
        break;
    }
  }
}
