import { Guid } from "@bitwarden/common/types/guid";

export interface ReceiveUrlData {
  receiveId: Guid;
  secretB64: string;
  sharedContentEncryptionKeyB64: string;
}
