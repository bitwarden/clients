// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../../models/response/base.response";
import { FileUploadType } from "../../../../platform/enums";

import { SendResponse } from "./send.response";

export class SendFileUploadDataResponse extends BaseResponse {
  fileUploadType: FileUploadType;
  sendResponse: SendResponse;
  url: string = null;
  constructor(response: any) {
    super(response);
    this.fileUploadType = this.getResponseProperty("FileUploadType");
    const sendResponse = this.getResponseProperty("SendResponse");
    this.sendResponse = sendResponse == null ? null : new SendResponse(sendResponse);
    this.url = this.getResponseProperty("Url");
  }
}
