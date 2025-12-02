import { PIN_DISK, PIN_MEMORY, UserKeyDefinition } from "@bitwarden/common/platform/state";
import { PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";

import { EncryptedString } from "../crypto/models/enc-string";

/**
 * The persistent (stored on disk) version of the UserKey, encrypted by the PinKey.
 *
 * @deprecated
 * @remarks Persists through a client reset. Used when `requireMasterPasswordOnClientRestart` is disabled.
 * @see SetPinComponent.setPinForm.requireMasterPasswordOnClientRestart
 */
export const PIN_KEY_ENCRYPTED_USER_KEY_PERSISTENT = new UserKeyDefinition<EncryptedString>(
  PIN_DISK,
  "pinKeyEncryptedUserKeyPersistent",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
  },
);

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
    },
  );

/**
 * The ephemeral (stored in memory) version of the UserKey, stored in a `PasswordProtectedKeyEnvelope`.
 */
export const PIN_PROTECTED_USER_KEY_ENVELOPE_EPHEMERAL =
  new UserKeyDefinition<PasswordProtectedKeyEnvelope>(
    PIN_MEMORY,
    "pinProtectedUserKeyEnvelopeEphemeral",
    {
      deserializer: (jsonValue) => jsonValue,
      clearOn: ["logout"],
    },
  );

/**
 * The PIN, encrypted by the UserKey.
 */
export const USER_KEY_ENCRYPTED_PIN = new UserKeyDefinition<EncryptedString>(
  PIN_DISK,
  "userKeyEncryptedPin",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
  },
);
