import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import { MessageCommon } from "./message-common";

export type EncryptedMessageResponse = MessageCommon & {
  encryptedPayload: EncString;
};
