import { PIN_DISK, PIN_MEMORY, UserKeyDefinition } from "@bitwarden/common/platform/state";
import {
  PasswordProtectedKeyEnvelope,
  EncString,
  EphemeralPinEnvelopeState,
} from "@bitwarden/sdk-internal";

/**
 * The persistent (stored on disk) version of the UserKey, stored in a `PasswordProtectedKeyEnvelope`.
 *
 * @remarks Persists through a client reset. Used when `requireMasterPasswordOnClientRestart` is disabled.
 * @see SetPinComponent.setPinForm.requireMasterPasswordOnClientRestart
 */
export const PIN_PROTECTED_USER_KEY_ENVELOPE_PERSISTENT =
  new UserKeyDefinition<PasswordProtectedKeyEnvelope>(
    PIN_DISK,
    "pinProtectedUserKeyEnvelopePersistent",
    {
      deserializer: (jsonValue) => jsonValue,
      clearOn: ["logout"],
      cleanupDelayMs: 0, // Prevents the state from caching and rxjs observable becoming hot observable.
    },
  );

/**
 * The ephemeral (stored in memory) version of the UserKey, stored in a `PasswordProtectedKeyEnvelope`.
 */
export const PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL =
  UserKeyDefinition.record<EphemeralPinEnvelopeState>(
    PIN_MEMORY,
    "pinProtectedUserKeyEnvelopeEphemeral",
    {
      deserializer: (jsonValue) => jsonValue,
      clearOn: ["logout"],
      // Prevents the state from caching and rxjs observable becoming hot observable.
      cleanupDelayMs: 0,
    },
  );

/**
 * The PIN, encrypted by the UserKey.
 */
export const USER_KEY_ENCRYPTED_PIN = new UserKeyDefinition<EncString>(
  PIN_DISK,
  "userKeyEncryptedPin",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
    cleanupDelayMs: 0, // Prevents the state from caching and rxjs observable becoming hot observable.
  },
);
