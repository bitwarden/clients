import { EncString } from "@bitwarden/common/key-management/crypto/models/domain/enc-string";

import { LegacyMessage } from "./legacy-message";

export type LegacyMessageWrapper = {
  message: LegacyMessage | EncString;
  appId: string;
};
