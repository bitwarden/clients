import { BaseResponse } from "../../../models/response/base.response";

export class AttachmentResponse extends BaseResponse {
  id: string;
  url: string;
  fileName: string;
  key: string;
  size: string;
  sizeName: string;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("Id");
    this.url = this.getResponseProperty("Url");
    this.fileName = this.getResponseProperty("FileName");
    this.key = this.getResponseProperty("Key");
    this.size = this.getResponseProperty("Size");
    this.sizeName = this.getResponseProperty("SizeName");
  }
}
