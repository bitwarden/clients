import { SendType } from "../../enums/sendType";
import { Guid } from "../../types/guid";
import { SendFileApi } from "../api/send-file.api";
import { SendTextApi } from "../api/send-text.api";

import { BaseResponse } from "./base.response";

export class SendResponse extends BaseResponse {
  id: Guid;
  accessId: string;
  type: SendType;
  name: string;
  notes: string;
  file: SendFileApi;
  text: SendTextApi;
  key: string;
  maxAccessCount?: number;
  accessCount: number;
  revisionDate: string;
  expirationDate: string;
  deletionDate: string;
  password: string;
  disable: boolean;
  hideEmail: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty<Guid>("Id");
    this.accessId = this.getResponseProperty("AccessId");
    this.type = this.getResponseProperty("Type");
    this.name = this.getResponseProperty("Name");
    this.notes = this.getResponseProperty("Notes");
    this.key = this.getResponseProperty("Key");
    this.maxAccessCount = this.getResponseProperty("MaxAccessCount");
    this.accessCount = this.getResponseProperty("AccessCount");
    this.revisionDate = this.getResponseProperty("RevisionDate");
    this.expirationDate = this.getResponseProperty("ExpirationDate");
    this.deletionDate = this.getResponseProperty("DeletionDate");
    this.password = this.getResponseProperty("Password");
    this.disable = this.getResponseProperty("Disabled") || false;
    this.hideEmail = this.getResponseProperty("HideEmail") || false;

    const text = this.getResponseProperty("Text");
    if (text != null) {
      this.text = new SendTextApi(text);
    }

    const file = this.getResponseProperty("File");
    if (file != null) {
      this.file = new SendFileApi(file);
    }
  }
}
