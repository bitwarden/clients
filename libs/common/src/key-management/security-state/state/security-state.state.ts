import { CRYPTO_MEMORY, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { SignedSecurityState } from "../models/security-state";

export const ACCOUNT_SECURITY_STATE = new UserKeyDefinition<SignedSecurityState>(
  CRYPTO_MEMORY,
  "accountSecurityState",
  {
    deserializer: (obj) => SignedSecurityState.fromJson(obj),
    clearOn: ["logout", "lock"],
  },
);
