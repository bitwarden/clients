import { Jsonify } from "type-fest";

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

  static fromJSON(obj: Jsonify<ReceiveFileData>): ReceiveFileData {
    return Object.assign(Object.create(ReceiveFileData.prototype) as ReceiveFileData, obj, {
      fileName: EncString.fromJSON(obj.fileName),
      encapsulatedFileContentEncryptionKey: EncString.fromJSON(
        obj.encapsulatedFileContentEncryptionKey,
      ),
    });
  }
}
