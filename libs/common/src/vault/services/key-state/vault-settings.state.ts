import { VAULT_SETTINGS_DISK, KeyDefinition, UserKeyDefinition } from "../../../platform/state";

export const USER_ENABLE_PASSKEYS = new KeyDefinition<boolean>(
  VAULT_SETTINGS_DISK,
  "enablePasskeys",
  {
    deserializer: (obj) => obj,
  },
);

export const SHOW_CARDS_CURRENT_TAB = new UserKeyDefinition<boolean>(
  VAULT_SETTINGS_DISK,
  "showCardsCurrentTab",
  {
    deserializer: (obj) => obj,
    clearOn: [], // do not clear user settings
  },
);

export const SHOW_IDENTITIES_CURRENT_TAB = new UserKeyDefinition<boolean>(
  VAULT_SETTINGS_DISK,
  "showIdentitiesCurrentTab",
  {
    deserializer: (obj) => obj,
    clearOn: [], // do not clear user settings
  },
);
