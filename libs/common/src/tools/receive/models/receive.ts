import { Guid } from "@bitwarden/common/types/guid";

import { ReceiveFileData } from "./data/receive-file.data";
import { ReceiveData } from "./data/receive.data";

export class Receive {
  id: Guid;
  name: string;
  file?: ReceiveFileData;
  userKeyWrappedSharedContentEncryptionKey: string;
  userKeyWrappedPrivateKey: string;
  scekWrappedPublicKey: string;
  secret: string;
  uploadCount: number;
  creationDate: string;
  revisionDate: string;
  expirationDate: string;

  constructor(data: ReceiveData) {
    this.id = data.id as Guid;
    this.name = data.name;
    this.file = data.file;
    this.userKeyWrappedSharedContentEncryptionKey = data.userKeyWrappedSharedContentEncryptionKey;
    this.userKeyWrappedPrivateKey = data.userKeyWrappedPrivateKey;
    this.scekWrappedPublicKey = data.scekWrappedPublicKey;
    this.secret = data.secret;
    this.uploadCount = data.uploadCount;
    this.creationDate = data.creationDate;
    this.revisionDate = data.revisionDate;
    this.expirationDate = data.expirationDate;
  }
}
