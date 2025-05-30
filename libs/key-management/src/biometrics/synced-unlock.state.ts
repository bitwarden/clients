import { UserKeyDefinition, SYNCED_UNLOCK_SETTINGS_DISK } from "@bitwarden/common/platform/state";

/**
 * Indicates whether the user elected to store a biometric key to unlock their vault.
 */
export const SYNCED_UNLOCK_ENABLED = new UserKeyDefinition<boolean>(
  SYNCED_UNLOCK_SETTINGS_DISK,
  "syncedUnlockEnabled",
  {
    deserializer: (obj: any) => obj,
    clearOn: [],
  },
);
