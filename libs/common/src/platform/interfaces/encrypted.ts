import { EncryptionType } from "@bitwarden/key-management";

export interface Encrypted {
  encryptionType?: EncryptionType;
  dataBytes: Uint8Array;
  macBytes: Uint8Array;
  ivBytes: Uint8Array;
}
