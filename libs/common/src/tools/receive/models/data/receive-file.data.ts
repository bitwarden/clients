import { ReceiveFileApi } from "../api/receive-file.api";

export class ReceiveFileData {
  id: string;
  fileName: string;
  size: string;
  sizeName: string;

  constructor(data: ReceiveFileApi) {
    this.id = data.id;
    this.fileName = data.fileName;
    this.size = data.size;
    this.sizeName = data.sizeName;
  }
}
