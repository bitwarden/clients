// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { UserId } from "../../types/guid";
import { PinKey, UserKey } from "../../types/key";

import { PinLockType } from "./pin-lock-type";

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
   * Gets the user's PIN
   * @throws If the user is locked
   * @returns The user's PIN
   */
  abstract getPin(userId: UserId): Promise<string>;

  /**
   * Setup pin unlock
   * @throws If the provided user is locked
   */
  abstract setPin(pin: string, pinLockType: PinLockType, userId: UserId): Promise<void>;

  /**
   * Clear pin unlock
   */
  abstract unsetPin(userId: UserId): Promise<void>;

  /**
   * Gets the user's PinLockType {@link PinLockType}.
   */
  abstract getPinLockType(userId: UserId): Promise<PinLockType>;

  /**
   * Declares whether or not the user has a PIN set (either persistent or ephemeral).
   * Note: for ephemeral, this does not check if we actual have an ephemeral PIN-encrypted UserKey stored in memory.
   * Decryption might not be possible even if this returns true. Use {@link isPinDecryptionAvailable} if decryption is required.
   */
  abstract isPinSet(userId: UserId): Promise<boolean>;

  /**
   * Checks if PIN-encrypted keys are stored for the user.
   * Used for unlock / user verification scenarios where we will need to decrypt the UserKey with the PIN.
   */
  abstract isPinDecryptionAvailable(userId: UserId): Promise<boolean>;

  /**
   * Clears ephemeral PINs for the user being logged out.
   */
  abstract logout(userId: UserId): Promise<void>;

  /**
   * Decrypts the UserKey with the provided PIN.
   * @returns UserKey
   * @throws If the pin lock type is ephemeral but the ephemeral pin protected user key envelope is not available
   */
  abstract decryptUserKeyWithPin(pin: string, userId: UserId): Promise<UserKey | null>;

  /**
   * Makes a PinKey from the provided PIN.
   * @deprecated - Note: This is currently re-used by vault exports, which is still permitted but should be refactored out to use a different construct.
   */
  abstract makePinKey(pin: string, salt: string, kdfConfig: KdfConfig): Promise<PinKey>;
}
