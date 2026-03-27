import { SymmetricCryptoKey } from "../../../../platform/models/domain/symmetric-crypto-key";
import { ReceiveId } from "../../../../types/guid";

import { ReceiveFileView } from "./receive-file.view";

export interface ReceiveView {
  id: ReceiveId;
  secret: string;
  expirationDate: Date;

  // Shared content
  name: string;
  publicKey: Uint8Array;
  sharedContentEncryptionKey: SymmetricCryptoKey;

  fileData?: ReceiveFileView[];
}
