import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { Guid } from "@bitwarden/common/types/guid";

// TODO add other properties when adding API functionality.
export interface Receive {
  id: Guid;
  secret: string;
  expirationDate: Date;

  // Encrypted shared content, encrypted by the sharedContentEncryptionKey (SCEK).
  name: EncString;
  scekWrappedPublicKey: EncString;

  userKeyWrappedPrivateKey: EncString;
  userKeyWrappedSharedContentEncryptionKey: EncString;

  fileData?: ReceiveFile[];
}

export interface ReceiveFile {
  id: Guid;
  size: string;
  fileName: EncString;
  encapsulatedFileContentEncryptionKey: EncString;
}
