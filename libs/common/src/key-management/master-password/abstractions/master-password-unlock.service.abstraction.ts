import { Account } from "../../../auth/abstractions/account.service";
import { UserKey } from "../../../types/key";

export abstract class MasterPasswordUnlockService {
  /**
   * Unlocks the user's account using the master password.
   * @param masterPassword The master password provided by the user.
   * @param activeAccount The active account for which the key is being unlocked.
   * @returns the user's decrypted userKey.
   */
  abstract unlockWithMasterPassword(
    masterPassword: string,
    activeAccount: Account,
  ): Promise<UserKey>;
}
