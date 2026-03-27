import { BaseResponse } from "../../../../models/response/base.response";

export class ReceiveFileApi extends BaseResponse {
  id: string;
  fileName: string;
  size: string;
  sizeName: string;

  constructor(data: any) {
    super(data);

    this.id = this.getResponseProperty("Id");
    this.fileName = this.getResponseProperty("FileName");
    this.size = this.getResponseProperty("Size");
    this.sizeName = this.getResponseProperty("SizeName");
  }
}
