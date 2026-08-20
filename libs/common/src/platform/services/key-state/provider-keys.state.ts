// eslint-disable-next-line no-restricted-imports
import { EncryptedString } from "@bitwarden/legacy-crypto";

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
