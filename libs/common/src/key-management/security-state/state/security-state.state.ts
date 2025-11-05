import { CRYPTO_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

import { SignedSecurityState } from "../../types";

export const ACCOUNT_SECURITY_STATE = new UserKeyDefinition<SignedSecurityState>(
  CRYPTO_DISK,
  "accountSecurityState",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);
