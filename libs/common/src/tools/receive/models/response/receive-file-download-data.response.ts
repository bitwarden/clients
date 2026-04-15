import { BaseResponse } from "../../../../models/response/base.response";

export class ReceiveFileDownloadDataResponse extends BaseResponse {
  id: string;
  url: string;

  constructor(response: any) {
    super(response);

    this.id = this.getResponseProperty("Id");
    this.url = this.getResponseProperty("Url");
  }
}
