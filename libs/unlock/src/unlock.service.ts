import { Observable } from "rxjs";

import { UserId } from "@bitwarden/common/types/guid";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

import { KeyConnectorUnlockData } from "./default-unlock.service";
import { UnlockMethod } from "./unlock-method.enum";

/**
 * An unlock that has happened in this context.
 */
export type UnlockEvent = {
  /** The user that was unlocked */
  userId: UserId;
  /** How the user was unlocked */
  method: UnlockMethod;
};

/**
 * Service for unlocking a user's account with various methods.
 */
export abstract class UnlockService {
  /**
   * Emits every unlock this context knows about: the ones it performed itself, and the ones it was
   * handed through {@link runOnUnlockActions}.
   *
   * This is the observable form of {@link registerOnUnlockAction} — prefer it in components, where
   * a subscription can be torn down with the component. The unlock's user key is deliberately not
   * emitted; read it from state if it is needed.
   */
  abstract unlocked$: Observable<UnlockEvent>;

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
   * @param method - How the caller obtained the key, reported to the unlock listeners. Callers that
   *   know better than the default should say so — a PRF credential or biometrics, for instance.
   * @throws If the SDK is not available
   * @throws If decryption fails or the key is invalid
   */
  abstract unlockWithDecryptedUserKey(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method?: UnlockMethod,
  ): Promise<void>;

  /**
   * Unlocks the user's account with a user key received from another device over the shared unlock
   * protocol.
   *
   * @param userId - The user's id
   * @param userKey - The decrypted user key the other device shared
   * @throws If the SDK is not available
   * @throws If decryption fails or the key is invalid
   */
  abstract unlockFromSharedUnlock(userId: UserId, userKey: SymmetricCryptoKey): Promise<void>;

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
   *   freshly-decrypted user key, and how they were unlocked.
   */
  abstract registerOnUnlockAction(
    action: (userId: UserId, userKey: SymmetricCryptoKey, method: UnlockMethod) => Promise<void>,
  ): void;

  /**
   * Runs the actions registered through {@link registerOnUnlockAction} for an unlock this service
   * did not perform itself.
   *
   * Clients that unlock in one context but keep on-unlock listeners in another use this to fan an
   * unlock out to the other context. The browser extension unlocks in the popup while listeners
   * such as the shared unlock peer live in the background, and unlocks the background performs
   * itself — biometrics, or another device over shared unlock — have to travel the other way.
   *
   * @param userId - The user's id
   * @param userKey - The user key the unlock produced
   * @param method - How the user was unlocked
   */
  abstract runOnUnlockActions(
    userId: UserId,
    userKey: SymmetricCryptoKey,
    method: UnlockMethod,
  ): Promise<void>;
}
