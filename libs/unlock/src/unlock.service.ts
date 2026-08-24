import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { KeyConnectorUnlockData } from "./default-unlock.service";
import { UnlockSource } from "./unlock-source.enum";

/**
 * Service for unlocking a user's account with various methods.
 */
export abstract class UnlockService {
  /**
   * Unlocks the user's account using their PIN.
   *
   * @param userId - The user's id
   * @param pin - The user's PIN
   * @throws If the SDK is not available
   * @throws If the PIN is invalid or decryption fails
   */
  abstract unlockWithPin(userId: UserId, pin: string): Promise<void>;

  /**
   * Unlocks the user's account using their master password.
   *
   * @param userId - The user's id
   * @param masterPassword - The user's master password
   * @throws If the SDK is not available
   * @throws If the master password is invalid or decryption fails
   */
  abstract unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<void>;

  /**
   * Unlocks the user's account using a biometrics-protected copy of the user-key
   * @param userId - The user's id
   * @throws If the SDK is not available
   * @throws If biometric authentication fails
   */
  abstract unlockWithBiometrics(userId: UserId): Promise<void>;

  /**
   * Unlocks the user's account using a key connector.
   *
   * @param keyConnectorUnlockData - The data required to unlock with the key connector, including the URL and wrapped user key
   * @throws If the SDK is not available
   * @throws If key connector authentication fails
   */
  abstract unlockWithKeyConnector(
    userId: UserId,
    keyConnectorUnlockData: KeyConnectorUnlockData,
  ): Promise<void>;

  /**
   * Unlocks the user's account with a decrypted user key
   * Note: Where possible use other unlock methods.
   *
   * @param userId - The user's id
   * @param userKey - The decrypted user key to unlock with
   * @throws If the SDK is not available
   * @throws If decryption fails or the key is invalid
   */
  abstract unlockWithDecryptedUserKey(userId: UserId, userKey: SymmetricCryptoKey): Promise<void>;

  /**
   * Unlocks the user's account using their never-lock ("auto") key, if one is stored.
   *
   * Users whose vault timeout is set to never have a copy of their user key persisted, so their
   * vault must load unlocked. Call this on application bootstrap and on active account changes.
   *
   * @param userId - The user's id
   * @returns True when a never-lock key was found and used, false when there was nothing to unlock with
   * @throws If the SDK is not available
   */
  abstract unlockWithAutoUnlockKey(userId: UserId): Promise<boolean>;

  /**
   * Registers an action to be run when a user is unlocked through this service.
   *
   * @param action Callback invoked after a successful unlock with the user id, the
   *   freshly-decrypted user key, and what caused the unlock.
   */
  abstract registerOnUnlockAction(
    action: (userId: UserId, userKey: SymmetricCryptoKey, source: UnlockSource) => Promise<void>,
  ): void;
}
