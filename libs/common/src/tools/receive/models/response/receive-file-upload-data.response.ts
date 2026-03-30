import { BaseResponse } from "../../../../models/response/base.response";
import { FileUploadType } from "../../../../platform/enums";

import { ReceiveResponse } from "./receive.response";

export class ReceiveFileUploadDataResponse extends BaseResponse {
  fileUploadType: FileUploadType;
  receiveResponse?: ReceiveResponse;
  url?: string;

  constructor(response: any) {
    super(response);

    this.fileUploadType = this.getResponseProperty("FileUploadType");
    const receiveResponse = this.getResponseProperty("ReceiveResponse");
    this.receiveResponse =
      receiveResponse != null ? new ReceiveResponse(receiveResponse) : undefined;
    this.url = this.getResponseProperty("Url") ?? undefined;
  }
}
