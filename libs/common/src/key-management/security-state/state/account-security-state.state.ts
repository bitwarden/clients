import { CRYPTO_MEMORY, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { SecurityState } from "../models/security-state";

export const ACCOUNT_SECURITY_STATE = new UserKeyDefinition<SecurityState>(
  CRYPTO_MEMORY,
  "accountSecurityState",
  {
    deserializer: (obj) => SecurityState.fromJson(obj),
    clearOn: ["logout", "lock"],
  },
);
