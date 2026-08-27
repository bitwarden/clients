import {
  KeyDefinition,
  BIOMETRIC_SETTINGS_DISK,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";
import { UserId } from "@bitwarden/common/types/guid";

/**
 * Indicates whether the user elected to store a biometric key to unlock their vault.
 */
export const BIOMETRIC_UNLOCK_ENABLED = new UserKeyDefinition<boolean>(
  BIOMETRIC_SETTINGS_DISK,
  "biometricUnlockEnabled",
  {
    deserializer: (obj: any) => obj,
    clearOn: [],
  },
);

/**
 * Stores whether the user has elected to cancel the biometric prompt. This is stored on disk due to process-reload
 * wiping memory state. We don't want to prompt the user again if they've elected to cancel.
 */
export const PROMPT_CANCELLED = KeyDefinition.record<boolean, UserId>(
  BIOMETRIC_SETTINGS_DISK,
  "promptCancelled",
  {
    deserializer: (obj) => obj,
  },
);

/**
 * Stores whether the user has elected to automatically prompt for biometric unlock on application start.
 */
export const PROMPT_AUTOMATICALLY = new UserKeyDefinition<boolean>(
  BIOMETRIC_SETTINGS_DISK,
  "promptAutomatically",
  {
    deserializer: (obj) => obj,
    clearOn: [],
  },
);

/**
 * Stores the key ID of the user key that was last enrolled in the biometric system.
 * Used to detect when the user key has changed and biometric keys need re-enrollment.
 */
export const BIOMETRIC_ENROLLED_KEY_ID = new UserKeyDefinition<string | null>(
  BIOMETRIC_SETTINGS_DISK,
  "biometricEnrolledKeyId",
  {
    deserializer: (obj) => obj,
    clearOn: [],
  },
);

/**
 * Last process reload time
 */
export const LAST_PROCESS_RELOAD = new KeyDefinition<Date>(
  BIOMETRIC_SETTINGS_DISK,
  "lastProcessReload",
  {
    deserializer: (obj) => new Date(obj),
  },
);
