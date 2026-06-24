import { V2UpgradeToken } from "@bitwarden/sdk-internal";

import { CRYPTO_DISK, UserKeyDefinition } from "../../platform/state";

export const V2_UPGRADE_TOKEN = new UserKeyDefinition<V2UpgradeToken>(
  CRYPTO_DISK,
  "v2UpgradeToken",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
    // Prevents the state from caching and rxjs observable becoming hot observable.
    cleanupDelayMs: 0,
  },
);
