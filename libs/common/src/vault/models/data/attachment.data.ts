// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AttachmentResponse } from "../response/attachment.response";

export class AttachmentData {
  id: string;
  url: string;
  fileName: string;
  key: string;
  size: string;
  sizeName: string;

  constructor(response?: AttachmentResponse) {
    if (response == null) {
      return;
    }
    this.id = response.id;
    this.url = response.url;
    this.fileName = response.fileName;
    this.key = response.key;
    this.size = response.size;
    this.sizeName = response.sizeName;
  }
}
