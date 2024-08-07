import { LegacyInnerCommandMessage } from "@bitwarden/auth/common";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

export type LegacyMessageWrapper = {
  message: LegacyInnerCommandMessage | EncString;
  appId: string;
};
