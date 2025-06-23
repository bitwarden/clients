import { CRYPTO_MEMORY, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { SerializedSecurityState } from "../models/security-state";

export const ACCOUNT_SECURITY_STATE = new UserKeyDefinition<SerializedSecurityState>(
  CRYPTO_MEMORY,
  "accountSecurityState",
  {
    deserializer: (obj) => SerializedSecurityState.fromJson(obj),
    clearOn: ["logout", "lock"],
  },
);
