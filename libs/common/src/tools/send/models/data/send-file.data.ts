// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SendFileApi } from "../api/send-file.api";

export class SendFileData {
  id: string;
  fileName: string;
  size: string;
  sizeName: string;

  constructor(data?: SendFileApi) {
    if (data == null) {
      return;
    }

    this.id = data.id;
    this.fileName = data.fileName;
    this.size = data.size;
    this.sizeName = data.sizeName;
  }
}
