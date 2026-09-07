// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendAccessResponse as SdkSendAccessResponse } from "@bitwarden/sdk-internal";

import { BaseResponse } from "../../../../models/response/base.response";
import { SendType } from "../../types/send-type";
import { SendFileApi } from "../api/send-file.api";
import { SendTextApi } from "../api/send-text.api";
import { SEND_TYPE_TO_SDK } from "../domain/send";

export class SendAccessResponse extends BaseResponse {
  id: string;
  type: SendType;
  name: string;
  file: SendFileApi;
  text: SendTextApi;
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

    const expirationDate = this.getResponseProperty("ExpirationDate");
    if (expirationDate != null) {
      this.expirationDate = new Date(expirationDate);
    }
    this.creatorIdentifier = this.getResponseProperty("CreatorIdentifier");
  }

  static toSdkAccessResponse(obj: SendAccessResponse): SdkSendAccessResponse {
    return {
      id: obj.id,
      name: obj.name,
      type: SEND_TYPE_TO_SDK[obj.type],
      creatorIdentifier: obj.creatorIdentifier,
      expirationDate: obj.expirationDate ? obj.expirationDate.toISOString() : undefined,
      text:
        obj.type === SendType.Text
          ? {
              text: obj.text?.text ?? undefined,
              hidden: obj.text?.hidden ?? false,
            }
          : undefined,
      file:
        obj.type === SendType.File
          ? {
              id: obj.file?.id ?? undefined,
              fileName: obj.file?.fileName ?? "",
              size: obj.file?.size ?? undefined,
              sizeName: obj.file?.sizeName ?? undefined,
            }
          : undefined,
      data: undefined,
    };
  }
}
