// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../../models/response/base.response";
import { SendType } from "../../types/send-type";
import { SendFileApi } from "../api/send-file.api";
import { SendItemApi } from "../api/send-item.api";
import { SendTextApi } from "../api/send-text.api";

export class SendAccessResponse extends BaseResponse {
  id: string;
  type: SendType;
  name: string;
  file: SendFileApi;
  text: SendTextApi;
  data: SendItemApi;
  expirationDate: Date;
  creatorIdentifier: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.type = this.getResponseProperty("Type");
    this.name = this.getResponseProperty("Name");

    const text = this.getResponseProperty("Text");
    if (text != null) {
      this.text = new SendTextApi(text);
    }

    const file = this.getResponseProperty("File");
    if (file != null) {
      this.file = new SendFileApi(file);
    }

    const data = this.getResponseProperty("Data");
    if (data != null) {
      this.data = new SendItemApi(data);
    }

    this.expirationDate = this.getResponseProperty("ExpirationDate");
    this.creatorIdentifier = this.getResponseProperty("CreatorIdentifier");
  }
}
