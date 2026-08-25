import { UserId } from "@bitwarden/common/types/guid";
import { UserKey } from "@bitwarden/common/types/key";
// eslint-disable-next-line no-restricted-imports
import { SymmetricCryptoKey } from "@bitwarden/legacy-crypto";

/**
 * The auto unlock service is responsible for the never-lock key
 */
export abstract class AutoUnlockService {
  /**
   * Retrieves the user's never-lock key, if one is stored.
   *
   * @param userId - The user's id
   * @returns The never-lock user key, or null when none is stored
   */
  abstract getAutoUnlockKey(userId: UserId): Promise<UserKey | null>;

  /**
   * Writes or clears the never-lock user key, according to whether the user's vault timeout allows
   * storing it. Called during unlock.
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
