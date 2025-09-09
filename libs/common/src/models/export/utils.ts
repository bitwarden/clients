import { EncString } from "../../key-management/crypto/models/enc-string";

export function safeGetString(value: string | EncString) {
  if (value == null) {
    return null;
  }

  if (typeof value == "string") {
    return value;
  }
  return value?.encryptedString;
}
