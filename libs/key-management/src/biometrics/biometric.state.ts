import { EncryptedString } from "@bitwarden/common/key-management/crypto/models/enc-string";
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
 * If the user has elected to require a password on first unlock of an application instance, this key will store the
 * encrypted client key half used to unlock the vault.
 *
 * For operating systems without application-level key storage, this key half is concatenated with a signature
 * provided by the OS and used to encrypt the biometric key prior to storage.
 */
export const ENCRYPTED_CLIENT_KEY_HALF = new UserKeyDefinition<EncryptedString>(
  BIOMETRIC_SETTINGS_DISK,
  "clientKeyHalf",
  {
    deserializer: (obj) => obj,
    clearOn: ["logout"],
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
 * Stores whether or not IPC handshake has been validated this session.
 */
export const FINGERPRINT_VALIDATED = new KeyDefinition<boolean>(
  BIOMETRIC_SETTINGS_DISK,
  "fingerprintValidated",
  {
    deserializer: (obj) => obj,
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
