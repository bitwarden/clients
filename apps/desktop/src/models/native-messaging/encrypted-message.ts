import { EncString } from "@bitwarden/key-management";

import { MessageCommon } from "./message-common";

export type EncryptedMessage = MessageCommon & {
  // Will decrypt to a DecryptedCommandData object
  encryptedCommand: EncString;
};
