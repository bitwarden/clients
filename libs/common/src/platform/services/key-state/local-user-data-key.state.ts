import { LocalUserDataKey } from "../../../key-management/types";
import { CRYPTO_DISK, UserKeyDefinition } from "../../state";

export const LOCAL_USER_DATA_KEY = UserKeyDefinition.record<LocalUserDataKey>(
  CRYPTO_DISK,
  "localUserDataKey",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
  },
);
