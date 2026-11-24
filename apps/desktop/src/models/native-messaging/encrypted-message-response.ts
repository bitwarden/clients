import { EncString } from "@bitwarden/sdk-internal";

import { MessageCommon } from "./message-common";

export type EncryptedMessageResponse = MessageCommon & {
  encryptedPayload: EncString;
};
