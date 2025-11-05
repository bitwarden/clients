import { EncString } from "../../key-management/crypto/models/enc-string";

export function safeGetString(value?: string | EncString) {
  if (!value) {
    return undefined;
  }

  if (typeof value == "string") {
    return value;
  }
  return value?.encryptedString ?? undefined;
}
