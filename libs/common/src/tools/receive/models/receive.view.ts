import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { Guid } from "@bitwarden/common/types/guid";

export interface ReceiveView {
  id: Guid;
  secret: string;
  expirationDate: Date;

  // Shared content
  name: string;
  publicKey: Uint8Array;
  sharedContentEncryptionKey: SymmetricCryptoKey;

  fileData?: ReceiveFileView[];
}

export interface ReceiveFileView {
  id: Guid;
  size: string;
  fileName: string;
  fileContentEncryptionKey: SymmetricCryptoKey;
}
