import { EncString } from "@bitwarden/common/key-management/crypto/models/domain/enc-string";

import { MessageCommon } from "./message-common";

export type EncryptedMessageResponse = MessageCommon & {
  encryptedPayload: EncString;
};
