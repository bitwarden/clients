import { VAULT_SETTINGS_DISK, UserKeyDefinition } from "@bitwarden/common/platform/state";

/**
 * Key definition for encrypted recent usernames
 * Uses UserKeyDefinition.array() which automatically encrypts data with user's key
 * Stored on disk encrypted at rest via the user key/state provider
 */
export const RECENT_USERNAMES_KEY = UserKeyDefinition.array<string>(
  VAULT_SETTINGS_DISK,
  "recentUsernames",
  {
    deserializer: (obj: string) => obj,
    clearOn: ["logout"], // Clear on logout for security
  },
);
