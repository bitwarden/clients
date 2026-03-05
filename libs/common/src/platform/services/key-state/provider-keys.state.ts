import { EncryptedString } from "../../../key-management/crypto/models/enc-string";
import { ProviderId } from "../../../types/guid";
import { CRYPTO_DISK, UserKeyDefinition } from "../../state";

export const USER_ENCRYPTED_PROVIDER_KEYS = UserKeyDefinition.record<EncryptedString, ProviderId>(
  CRYPTO_DISK,
  "providerKeys",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);
