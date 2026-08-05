import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";

/**
 * Service owning the never-lock ("auto") copy of the user key.
 *
 * The never-lock key lets a user's vault load unlocked without them entering a credential, so it may
 * only be stored while their vault timeout is set to never.
 *
 * To unlock a user with their never-lock key, use `UnlockService.unlockWithAutoUnlockKey`.
 */
export abstract class AutoUnlockService {
  /**
   * Retrieves the user's never-lock key, if one is stored. Any stored copies of the user key are
   * thrown away when the retrieved key fails validation.
   *
   * @param userId - The user's id
   * @returns The never-lock user key, or null when none is stored
   */
  abstract getAutoUnlockKey(userId: UserId): Promise<UserKey | null>;

  /**
   * Writes or clears the never-lock user key, according to whether the user's vault timeout allows
   * storing it. Called during unlock, where the freshly decrypted user key is already in hand.
   *
   * @param userId - The user's id
   * @param userKey - The user's decrypted user key
   */
  abstract setAutoUnlockKey(userId: UserId, userKey: SymmetricCryptoKey): Promise<void>;

  /**
   * Re-evaluates never-lock storage for an already-unlocked user. Call after changing a setting that
   * affects whether the user key may be stored.
   *
   * @param userId - The user's id
   * @throws If the user is locked
   */
  abstract refreshAutoUnlockKey(userId: UserId): Promise<void>;
}
