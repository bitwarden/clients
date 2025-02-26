import { KeyService } from "@bitwarden/key-management";

import { UserId } from "../../types/guid";
import { KeySuffixOptions } from "../enums";

// TODO: this is a half measure improvement which allows us to reduce some side effects today (keyService.getUserKey setting user key in memory if auto key exists)
// but ideally, in the future, we would be able to put this logic into the keyService
// after the vault timeout settings service is transitioned to state provider so that
// the getUserKey logic can simply go to the correct location based on the vault timeout settings
// similar to the TokenService (it would either go to secure storage for the auto user key or memory for the user key)

export class UserAutoUnlockKeyService {
  constructor(private keyService: KeyService) {}

  /**
   * The presence of the user key in memory dictates whether the user's vault is locked or unlocked.
   * However, for users that have the auto unlock user key set, we need to set the user key in memory
   * on application bootstrap and on active account changes so that the user's vault loads unlocked.
   * @param userId - The user id to check for an auto user key.
   * @returns True if the auto user key is set successfully, false otherwise.
   */
  async setUserKeyInMemoryIfAutoUserKeySet(userId: UserId): Promise<boolean> {
    if (userId == null) {
      return false;
    }

    const autoUserKey = await this.keyService.getUserKeyFromStorage(KeySuffixOptions.Auto, userId);

    if (autoUserKey == null) {
      return false;
    }

    await this.keyService.setUserKey(autoUserKey, userId);
    return true;
  }
}
