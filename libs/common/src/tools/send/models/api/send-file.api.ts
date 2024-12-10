// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { BaseResponse } from "../../../../models/response/base.response";

export class SendFileApi extends BaseResponse {
  id: string;
  fileName: string;
  size: string;
  sizeName: string;

  constructor(data: any = null) {
    super(data);
    if (data == null) {
      return;
    }
    this.id = this.getResponseProperty("Id");
    this.fileName = this.getResponseProperty("FileName");
    this.size = this.getResponseProperty("Size");
    this.sizeName = this.getResponseProperty("SizeName");
  }
}
