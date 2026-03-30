import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { ReceiveFileId } from "../../../../types/guid";

export interface ReceiveFileView {
  id: ReceiveFileId;
  size: string;
  fileName: string;
  fileContentEncryptionKey: SymmetricCryptoKey;
}
