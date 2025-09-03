// eslint-disable-next-line no-restricted-imports
import { KdfConfig } from "@bitwarden/key-management";

import { UserId } from "../../types/guid";
import { PinKey, UserKey } from "../../types/key";

import { PinLockType } from "./pin-lock-type";

/**
 * The PinService provides PIN-based unlock functionality for user accounts.
 *
 * ## Overview
 *
 * - The PIN is used to unlock the user's UserKey
 * - PIN state and key material are managed using secure envelopes and encrypted state, with support for both ephemeral (in-memory) and persistent (on-disk) storage.
 *   When stored ephemerally, PIN unlock is only available after first unlock. When stored persistent, PIN unlock is available before first unlock.
 * - The PIN is also stored, encrypted with the user's UserKey. After first unlock, the PIN can be retrieved.
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
   * @deprecated This is not deprecated, but only meant to be called by KeyService. DO NOT USE IT.
   */
  abstract userUnlocked(userId: UserId): Promise<void>;

  /**
   * Makes a PinKey from the provided PIN.
   * @deprecated - Note: This is currently re-used by vault exports, which is still permitted but should be refactored out to use a different construct.
   */
  abstract makePinKey(pin: string, salt: string, kdfConfig: KdfConfig): Promise<PinKey>;
}
