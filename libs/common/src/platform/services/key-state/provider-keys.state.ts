import { UnsignedSharedKey } from "@bitwarden/sdk-internal";

import { ProviderId } from "../../../types/guid";
import { CRYPTO_DISK, UserKeyDefinition } from "../../state";

export const USER_ENCRYPTED_PROVIDER_KEYS = UserKeyDefinition.record<UnsignedSharedKey, ProviderId>(
  CRYPTO_DISK,
  "providerKeys",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);
