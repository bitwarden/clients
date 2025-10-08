import { Observable } from "rxjs";

import { PasswordProtectedKeyEnvelope } from "@bitwarden/sdk-internal";

import { UserId } from "../../types/guid";
import { EncryptedString, EncString } from "../crypto/models/enc-string";

import { PinLockType } from "./pin-lock-type";

/**
 * The PinStateService manages the storage and retrieval of PIN-related state for user accounts.
 */
export abstract class PinStateServiceAbstraction {
  /**
   * Gets the user's UserKey encrypted PIN
   * @param userId The user's id
   * @throws If the user id is not provided
   */
  abstract userKeyEncryptedPin$(userId: UserId): Observable<EncString | null>;

  /**
   * Gets the user's {@link PinLockType}
   * @param userId The user's id
   * @throws If the user id is not provided
   */
  abstract getPinLockType(userId: UserId): Promise<PinLockType>;

  /**
   * Checks if a user is enrolled into PIN unlock
   * @param userId The user's id
   */
  abstract isPinSet(userId: UserId): Promise<boolean>;

  /**
   * Gets the user's PIN-protected UserKey envelope, either persistent or ephemeral based on the provided PinLockType
   * @param userId The user's id
   * @param pinLockType User's {@link PinLockType}.
   * @throws if the user id is not provided
   * @throws if the pin lock type is not persistent or ephemeral
   */
  abstract getPinProtectedUserKeyEnvelope(
    userId: UserId,
    pinLockType: PinLockType,
  ): Promise<PasswordProtectedKeyEnvelope | null>;

  /**
   * Gets the user's legacy PIN-protected UserKey
   * @deprecated Use {@link getPinProtectedUserKeyEnvelope} instead. Only for migration support.
   * @param userId The user's id
   * @throws If the user id is not provided
   */
  abstract getLegacyPinKeyEncryptedUserKeyPersistent(userId: UserId): Promise<EncString | null>;

  /**
   * Sets the PIN state for the user
   * @param userId The user's id
   * @param pinProtectedUserKeyEnvelope The user's PIN-protected UserKey envelope
   * @param userKeyEncryptedPin The user's UserKey-encrypted PIN
   * @param pinLockType The user's PinLockType
   * @throws If the user id, pinProtectedUserKeyEnvelope, or pinLockType is not provided
   * @throws If the pin lock type is not persistent or ephemeral
   */
  abstract setPinState(
    userId: UserId,
    pinProtectedUserKeyEnvelope: PasswordProtectedKeyEnvelope,
    userKeyEncryptedPin: EncryptedString,
    pinLockType: PinLockType,
  ): Promise<void>;

  /**
   * Clears all PIN state for the user, both persistent and ephemeral
   * @param userId The user's id
   * @throws If the user id is not provided
   */
  abstract clearPinState(userId: UserId): Promise<void>;

  /**
   * Clears only the user's ephemeral PIN. Persistent PIN state and UserKey wrapped PIN remains unchanged.
   * @param userId The user's id
   * @throws If the user id is not provided
   */
  abstract clearEphemeralPinState(userId: UserId): Promise<void>;
}
