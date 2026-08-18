// eslint-disable-next-line no-restricted-imports
import { EncString } from "@bitwarden/legacy-crypto";

export function safeGetString(value: string | EncString | undefined | null): string | undefined {
  if (value == null) {
    return undefined;
  }

  if (typeof value == "string") {
    return value;
  }
  return value?.encryptedString;
}
