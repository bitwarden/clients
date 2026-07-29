import { LocalUserDataKey } from "../../../key-management/types";
import { CRYPTO_DISK, UserKeyDefinition } from "../../state";

export const LOCAL_USER_DATA_KEY = UserKeyDefinition.record<LocalUserDataKey>(
  CRYPTO_DISK,
  "localUserDataKey",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
    // Prevents the state from caching and rxjs observable becoming hot observable.
    cleanupDelayMs: 0,
  },
);
