import { EncString } from "@bitwarden/key-management";

export function safeGetString(value: string | EncString) {
  if (value == null) {
    return null;
  }

  if (typeof value == "string") {
    return value;
  }
  return value?.encryptedString;
}
