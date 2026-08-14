import { Jsonify } from "type-fest";

// There is no way to prevent this restricted import currently. These should be extracted out into a separate package.
// eslint-disable-next-line no-restricted-imports
import {
  Argon2KdfConfig,
  KdfConfig,
  KdfType,
  PBKDF2KdfConfig,
  SymmetricCryptoKey,
} from "@bitwarden/legacy-crypto";
import {
  EncString,
  EphemeralPinEnvelopeState,
  PasswordProtectedKeyEnvelope,
  V2UpgradeToken,
  WebAuthnPrfUnlockData,
  WrappedAccountCryptographicState,
} from "@bitwarden/sdk-internal";
import {
  CRYPTO_DISK,
  CRYPTO_MEMORY,
  KDF_CONFIG_DISK,
  MASTER_PASSWORD_UNLOCK_DISK,
  PIN_DISK,
  PIN_MEMORY,
  UserKeyDefinition,
} from "@bitwarden/state";

import { UserKey } from "../types/key";

import { MasterPasswordUnlockData } from "./master-password/types/master-password.types";

/**
 * State definitions for the key management domain. These are the states the SDK reaches into via
 * the state bridge (`JsWasmStateBridge`), so they are collected here rather than living next to
 * whichever service happened to need them first.
 */

/**
 * The UserKey, held in memory while the account is unlocked.
 */
export const USER_KEY = UserKeyDefinition.record<UserKey>(CRYPTO_MEMORY, "userKey", {
  deserializer: (obj) => SymmetricCryptoKey.fromJSON(obj) as UserKey,
  clearOn: ["logout", "lock"],
  // Prevents the state from caching and rxjs observable becoming hot observable.
  cleanupDelayMs: 0,
});

/**
 * The KDF configuration used to derive the master key from the master password.
 */
export const KDF_CONFIG = new UserKeyDefinition<KdfConfig>(KDF_CONFIG_DISK, "kdfConfig", {
  deserializer: (kdfConfig: Jsonify<KdfConfig>) => {
    if (kdfConfig == null) {
      return null;
    }
    return kdfConfig.kdfType === KdfType.PBKDF2_SHA256
      ? PBKDF2KdfConfig.fromJSON(kdfConfig)
      : Argon2KdfConfig.fromJSON(kdfConfig);
  },
  clearOn: ["logout"],
});

/**
 * Everything needed to unlock the account with the master password.
 *
 * @remarks Disk, to persist through lock.
 */
export const MASTER_PASSWORD_UNLOCK_DATA = new UserKeyDefinition<MasterPasswordUnlockData>(
  MASTER_PASSWORD_UNLOCK_DISK,
  "masterPasswordUnlockKey",
  {
    deserializer: (obj) => MasterPasswordUnlockData.fromJSON(obj),
    clearOn: ["logout"],
  },
);

/**
 * The account's wrapped cryptographic state (key pairs and the keys protecting them).
 */
export const ACCOUNT_CRYPTOGRAPHIC_STATE = new UserKeyDefinition<WrappedAccountCryptographicState>(
  CRYPTO_DISK,
  "accountCryptographicState",
  {
    deserializer: (obj) => obj as WrappedAccountCryptographicState,
    clearOn: ["logout"],
  },
);

/**
 * The token authorizing an upgrade of the account to V2 encryption.
 */
export const V2_UPGRADE_TOKEN = new UserKeyDefinition<V2UpgradeToken>(
  CRYPTO_DISK,
  "v2UpgradeToken",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
    // Prevents the state from caching and rxjs observable becoming hot observable.
    cleanupDelayMs: 0,
  },
);

/**
 * Every WebAuthn PRF credential the account can unlock with, stored in the SDK's own shape so the
 * state bridge can hand it to the SDK without mapping.
 */
export const WEBAUTHN_PRF_OPTIONS = new UserKeyDefinition<WebAuthnPrfUnlockData>(
  CRYPTO_DISK,
  "webAuthnPrfOptions",
  {
    deserializer: (jsonValue) => jsonValue,
    clearOn: ["logout"],
    // Prevents the state from caching and rxjs observable becoming hot observable.
    cleanupDelayMs: 0,
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
