import { VAULT_SETTINGS_DISK, KeyDefinition } from "../../../platform/state";

export const USER_ENABLE_PASSKEYS = new KeyDefinition<boolean>(
  VAULT_SETTINGS_DISK,
  "enablePasskeys",
  {
    deserializer: (obj) => obj,
  },
);

export const SHOW_CARDS_CURRENT_TAB = new KeyDefinition<boolean>(
  VAULT_SETTINGS_DISK,
  "showCardsCurrentTab",
  {
    deserializer: (obj) => obj,
  },
);

export const SHOW_IDENTITIES_CURRENT_TAB = new KeyDefinition<boolean>(
  VAULT_SETTINGS_DISK,
  "showIdentitiesCurrentTab",
  { deserializer: (obj) => obj },
);
