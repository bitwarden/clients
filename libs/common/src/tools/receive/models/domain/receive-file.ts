import { EncString } from "../../../../key-management/crypto/models/enc-string";
import { ReceiveFileId } from "../../../../types/guid";
import { ReceiveFileData } from "../data/receive-file.data";

export class ReceiveFile {
  id: ReceiveFileId;
  fileName: EncString;
  size: string;
  sizeName: string;
  encapsulatedFileContentEncryptionKey: EncString;

  constructor(data: ReceiveFileData) {
    this.id = data.id as ReceiveFileId;
    this.fileName = data.fileName;
    this.size = data.size;
    this.sizeName = data.sizeName;
    this.encapsulatedFileContentEncryptionKey = data.encapsulatedFileContentEncryptionKey;
  }
}
