import { UserKeyDefinition, VAULT_TIMEOUT_SETTINGS_DISK_LOCAL } from "../../../platform/state";
import { VaultTimeoutAction } from "../enums/vault-timeout-action.enum";
import { VaultTimeout } from "../types/vault-timeout.type";

/**
 * Settings use disk storage and local storage on web so settings can persist after logout
 * in order for us to know if the user's chose to never lock their vault or not.
 * When the user has never lock selected, we have to set the user key in memory
 * from the user auto unlock key stored on disk on client bootstrap.
 */
export const VAULT_TIMEOUT_ACTION = new UserKeyDefinition<VaultTimeoutAction>(
  VAULT_TIMEOUT_SETTINGS_DISK_LOCAL,
  "vaultTimeoutAction",
  {
    deserializer: (vaultTimeoutAction) => vaultTimeoutAction,
    clearOn: [], // persisted on logout
  },
);

export const VAULT_TIMEOUT = new UserKeyDefinition<VaultTimeout>(
  VAULT_TIMEOUT_SETTINGS_DISK_LOCAL,
  "vaultTimeout",
  {
    deserializer: (vaultTimeout) => vaultTimeout,
    clearOn: [], // persisted on logout
  },
);
