import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";

import { LegacyMessage } from "./legacy-message";

export type LegacyMessageWrapper = {
  message: LegacyMessage | EncString;
  appId: string;
};
