import { EncString } from "@bitwarden/common/key-management/crypto/models/enc-string";
import { UserId } from "@bitwarden/common/types/guid";
import { PinKey, UserKey } from "@bitwarden/common/types/key";
import { KdfConfig } from "@bitwarden/key-management";

import { PinLockType } from "../services";

/**
 * The PinService is used for PIN-based unlocks. Below is a very basic overview of the PIN flow:
 *
 * -- Setting the PIN via {@link SetPinComponent} --
 *
 *    When the user submits the setPinForm:

 *    1. We encrypt the PIN with the UserKey and store it on disk as `userKeyEncryptedPin`.
 *
 *    2. We create a PinKey from the PIN, and then use that PinKey to encrypt the UserKey, resulting in
 *       a `pinKeyEncryptedUserKey`, which can be stored in one of two ways depending on what the user selects
 *       for the `requireMasterPasswordOnClientReset` checkbox.
 *
 *       If `requireMasterPasswordOnClientReset` is:
 *       - TRUE, store in memory as `pinKeyEncryptedUserKeyEphemeral` (does NOT persist through a client reset)
 *       - FALSE, store on disk as `pinKeyEncryptedUserKeyPersistent` (persists through a client reset)
 *
 * -- Unlocking with the PIN via {@link LockComponent} --
 *
 *    When the user enters their PIN, we decrypt their UserKey with the PIN and set that UserKey to state.
 */
export abstract class PinServiceAbstraction {
  /**
   * Gets the persistent (stored on disk) version of the UserKey, encrypted by the PinKey.
   */
  abstract getPinKeyEncryptedUserKeyPersistent: (userId: UserId) => Promise<EncString | null>;

  /**
   * Clears the persistent (stored on disk) version of the UserKey, encrypted by the PinKey.
   */
  abstract clearPinKeyEncryptedUserKeyPersistent(userId: UserId): Promise<void>;

  /**
   * Gets the ephemeral (stored in memory) version of the UserKey, encrypted by the PinKey.
   */
  abstract getPinKeyEncryptedUserKeyEphemeral: (userId: UserId) => Promise<EncString | null>;

  /**
   * Clears the ephemeral (stored in memory) version of the UserKey, encrypted by the PinKey.
   */
  abstract clearPinKeyEncryptedUserKeyEphemeral(userId: UserId): Promise<void>;

  /**
   * Creates a pinKeyEncryptedUserKey from the provided PIN and UserKey.
   */
  abstract createPinKeyEncryptedUserKey: (
    pin: string,
    userKey: UserKey,
    userId: UserId,
  ) => Promise<EncString>;

  /**
   * Stores the UserKey, encrypted by the PinKey.
   * @param storeEphemeralVersion If true, stores an ephemeral version via the private {@link setPinKeyEncryptedUserKeyEphemeral} method.
   *                              If false, stores a persistent version via the private {@link setPinKeyEncryptedUserKeyPersistent} method.
   */
  abstract storePinKeyEncryptedUserKey: (
    pinKeyEncryptedUserKey: EncString,
    storeEphemeralVersion: boolean,
    userId: UserId,
  ) => Promise<void>;

  /**
   * Gets the user's PIN, encrypted by the UserKey.
   */
  abstract getUserKeyEncryptedPin: (userId: UserId) => Promise<EncString | null>;

  /**
   * Sets the user's PIN, encrypted by the UserKey.
   */
  abstract setUserKeyEncryptedPin: (
    userKeyEncryptedPin: EncString,
    userId: UserId,
  ) => Promise<void>;

  /**
   * Creates a PIN, encrypted by the UserKey.
   */
  abstract createUserKeyEncryptedPin: (pin: string, userKey: UserKey) => Promise<EncString>;

  /**
   * Clears the user's PIN, encrypted by the UserKey.
   */
  abstract clearUserKeyEncryptedPin(userId: UserId): Promise<void>;

  /**
   * Makes a PinKey from the provided PIN.
   */
  abstract makePinKey: (pin: string, salt: string, kdfConfig: KdfConfig) => Promise<PinKey>;

  /**
   * Gets the user's PinLockType {@link PinLockType}.
   */
  abstract getPinLockType: (userId: UserId) => Promise<PinLockType>;

  /**
   * Declares whether or not the user has a PIN set (either persistent or ephemeral).
   * Note: for ephemeral, this does not check if we actual have an ephemeral PIN-encrypted UserKey stored in memory.
   * Decryption might not be possible even if this returns true. Use {@link isPinDecryptionAvailable} if decryption is required.
   */
  abstract isPinSet: (userId: UserId) => Promise<boolean>;

  /**
   * Checks if PIN-encrypted keys are stored for the user.
   * Used for unlock / user verification scenarios where we will need to decrypt the UserKey with the PIN.
   */
  abstract isPinDecryptionAvailable: (userId: UserId) => Promise<boolean>;

  /**
   * Decrypts the UserKey with the provided PIN.
   *
   * @remarks - If the user has an old pinKeyEncryptedMasterKey (formerly called `pinProtected`), the UserKey
   *            will be obtained via the private {@link decryptAndMigrateOldPinKeyEncryptedMasterKey} method.
   *          - If the user does not have an old pinKeyEncryptedMasterKey, the UserKey will be obtained via the
   *            private {@link decryptUserKey} method.
   * @returns UserKey
   */
  abstract decryptUserKeyWithPin: (pin: string, userId: UserId) => Promise<UserKey | null>;
}
