import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { Guid } from "@bitwarden/common/types/guid";

import { ReceiveFileData } from "./data/receive-file.data";
import { ReceiveData } from "./data/receive.data";

export class Receive {
  id: Guid;

  // Encrypted shared content, encrypted by the sharedContentEncryptionKey (SCEK).
  name: EncString;
  scekWrappedPublicKey: EncString;

  userKeyWrappedSharedContentEncryptionKey: EncString;
  userKeyWrappedPrivateKey: EncString;

  file?: ReceiveFileData[];
  secret: string;
  uploadCount: number;
  creationDate: Date;
  revisionDate: Date;
  expirationDate: Date;

  constructor(data: ReceiveData) {
    this.id = data.id as Guid;
    this.name = new EncString(data.name);
    this.userKeyWrappedSharedContentEncryptionKey = new EncString(
      data.userKeyWrappedSharedContentEncryptionKey,
    );
    this.userKeyWrappedPrivateKey = new EncString(data.userKeyWrappedPrivateKey);
    this.scekWrappedPublicKey = new EncString(data.scekWrappedPublicKey);
    this.secret = data.secret;
    this.uploadCount = data.uploadCount;
    this.creationDate = new Date(data.creationDate);
    this.revisionDate = new Date(data.revisionDate);
    this.expirationDate = new Date(data.expirationDate);
  }
}
