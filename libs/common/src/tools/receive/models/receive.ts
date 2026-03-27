import { Guid } from "@bitwarden/common/types/guid";

import { ReceiveFileApi } from "./api/receive-file.api";

export interface Receive {
  id: Guid;
  name: string;
  file: ReceiveFileApi | null;
  userKeyWrappedSharedContentEncryptionKey: string;
  userKeyWrappedPrivateKey: string;
  scekWrappedPublicKey: string;
  secret: string;
  uploadCount: number;
  creationDate: string;
  revisionDate: string;
  expirationDate: string | null;
}
