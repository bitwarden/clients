import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { ReceiveFileApi } from "../api/receive-file.api";

export class ReceiveFileData {
  id: string;
  fileName: EncString;
  size: string;
  sizeName: string;
  encapsulatedFileContentEncryptionKey: EncString;

  constructor(data: ReceiveFileApi) {
    this.id = data.id;
    this.fileName = new EncString(data.fileName);
    this.size = data.size;
    this.sizeName = data.sizeName;
    this.encapsulatedFileContentEncryptionKey = new EncString(
      data.encapsulatedFileContentEncryptionKey,
    );
  }
}
