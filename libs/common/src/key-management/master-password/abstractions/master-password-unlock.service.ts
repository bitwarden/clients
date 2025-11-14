import { UserId } from "@bitwarden/user-core";

import { UserKey } from "../../../types/key";

export abstract class MasterPasswordUnlockService {
  /**
   * Unlocks the user's account using the master password.
   * @param masterPassword The master password provided by the user.
   * @param userId The ID of the active user.
   * @throws If the master password provided is null/undefined/empty.
   * @throws If the userId provided is null/undefined.
   * @throws if the masterPasswordUnlockData for the user is not found.
   * @throws If unwrapping the user key fails.
   * @returns the user's decrypted userKey.
   */
  abstract unlockWithMasterPassword(masterPassword: string, userId: UserId): Promise<UserKey>;

  /**
   * For the given master password and user ID, verifies whether the user can decrypt their user key stored in state.
   * @param masterPassword The master password provided by the user.
   * @param userId The ID of the active user.
   * @throws If the master password provided is null/undefined/empty.
   * @throws If the userId provided is null/undefined.
   * @returns true if the userKey can be decrypted, false otherwise.
   */
  abstract proofOfDecryption(masterPassword: string, userId: UserId): Promise<boolean>;
}
