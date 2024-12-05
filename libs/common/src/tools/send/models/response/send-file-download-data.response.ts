// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../../models/response/base.response";

export class SendFileDownloadDataResponse extends BaseResponse {
  id: string = null;
  url: string = null;
  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.url = this.getResponseProperty("Url");
  }
}
