import { UserId } from "@bitwarden/user-core";

import { UserKey } from "../../../types/key";

export abstract class MasterPasswordUnlockService {
  /**
   * Unlocks the user's account using the master password.
   * @param userId The ID of the active user.
   * @param masterPassword The master password provided by the user.
   * @returns the user's decrypted userKey.
   */
  abstract unlockWithMasterPassword(userId: UserId, masterPassword: string): Promise<UserKey>;
}
